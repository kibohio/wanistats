import { stageName } from '../../domain/items';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Stepper } from '../../components/Stepper';
import { ItemSheet } from '../../components/ItemSheet';
import { Tile } from '../../components/Tile';
import { usePref } from '../../db/prefs';
import { formatTime, plural, type Clock } from '../../format';
import { useClock } from '../../hooks/useClock';
import { daysBetween, localDayStart } from '../../domain/localDate';
import type { Granularity, StackKey, TimelineBin, TimelineRange } from '../../domain/timeline';
import styles from './Timeline.module.css';
import { granularityFor, useTimelineData, type TimelineData } from './useTimelineData';

export const RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '120d', label: '120 days' },
] as const satisfies readonly { value: TimelineRange; label: string }[];

const KEY_LABEL: Record<StackKey, string> = {
  apprentice: 'Apprentice',
  guru: 'Guru',
  master: 'Master',
  enlightened: 'Enlightened',
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
};

const KEY_COLOR: Record<StackKey, string> = {
  apprentice: 'var(--srs-a3)',
  guru: 'var(--srs-guru)',
  master: 'var(--srs-master)',
  enlightened: 'var(--srs-enlightened)',
  radical: 'var(--srs-a3)',
  kanji: 'var(--srs-guru)',
  vocabulary: 'var(--srs-master)',
};

const BIN_NOUN: Record<Granularity, string> = { hour: 'hour', day: 'day', week: 'week' };

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const fullDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function dayWord(ms: number, today: number): string {
  const d = daysBetween(today, localDayStart(ms));
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : weekday.format(ms);
}

function binTitle(b: TimelineBin, i: number, g: Granularity, today: number, clock: Clock): string {
  if (g === 'hour') return `${dayWord(b.start, today)}, ${formatTime(b.start, clock)}`;
  if (g === 'day') return i === 0 ? 'Rest of today' : fullDay.format(b.start);
  return `Week of ${dayMonth.format(b.start)}`;
}

function binLabel(
  b: TimelineBin,
  i: number,
  n: number,
  g: Granularity,
  desktop: boolean,
  today: number,
  clock: Clock,
) {
  if (g === 'hour') {
    const h = new Date(b.start).getHours();
    if (n <= 24) return i % (desktop ? 3 : 6) === 0 ? formatTime(b.start, clock, true) : '';
    return i === 0 || h === 0 ? dayWord(b.start, today) : '';
  }
  if (g === 'day' && n <= 7) return i === 0 ? 'Today' : weekday.format(b.start);
  return i % (g === 'week' ? 4 : n > 60 ? 28 : 7) === 0 ? dayMonth.format(b.start) : '';
}

function extras(b: TimelineBin): string[] {
  const out: string[] = [];
  if (b.critical) out.push(`${b.critical.toLocaleString()} level-critical`);
  if (b.burns) out.push(plural(b.burns, 'burn review'));
  if (b.estimate) out.push(`${b.estimate.toLocaleString()} more from new lessons (estimate)`);
  return out;
}

interface ChartProps {
  data: TimelineData;
  granularity: Granularity;
  /** Running-total line, denser labels and the selection panel beside the bars. */
  desktop?: boolean;
}

/**
 * Stacked review bars with markers and a selection panel. Arrow keys, Home and End move the
 * selection. Remount with a `key` per range so the selection starts at the first bar.
 */
export function TimelineChart({ data, granularity, desktop = false }: ChartProps) {
  const { bins, keys, total, estimateTotal } = data.timeline;
  const [picked, setPicked] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = bins.length;
  const sel = Math.min(picked, n - 1);
  const today = bins[0] ? localDayStart(bins[0].start) : 0;
  const clock = useClock();
  const max = Math.max(1, ...bins.map((b) => b.total + b.estimate));
  const grand = total + estimateTotal;
  const marks = granularity === 'hour' || n <= (desktop ? 30 : 7);
  const gap = desktop ? (n > 60 ? 1 : 3) : n <= 7 ? 8 : n <= 20 ? 4 : 2;
  const pct = (v: number) => `${(v / max) * 100}%`;

  const move = (i: number) => {
    const j = Math.max(0, Math.min(n - 1, i));
    setPicked(j);
    refs.current[j]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const to = { ArrowLeft: sel - 1, ArrowRight: sel + 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    move(to);
  };

  const points = bins
    .map((b, i) => `${i + 0.5},${100 - ((b.runningTotal + b.runningEstimate) / grand) * 100}`)
    .join(' ');

  const b = bins[sel];
  return (
    <div className={desktop ? styles.chartWide : styles.chart}>
      <div>
        <div className={styles.plotWrap}>
          <div className={styles.plot}>
            <div
              role="group"
              aria-label={`Upcoming reviews by ${BIN_NOUN[granularity]}`}
              className={styles.bars}
              style={{ gap }}
            >
              {bins.map((bin, i) => {
                const title = binTitle(bin, i, granularity, today, clock);
                const x = extras(bin);
                return (
                  <button
                    key={bin.start}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    tabIndex={i === sel ? 0 : -1}
                    aria-pressed={i === sel}
                    aria-label={[title, plural(bin.total + bin.estimate, 'review'), ...x].join(
                      ', ',
                    )}
                    className={styles.bar}
                    onClick={() => setPicked(i)}
                    onKeyDown={onKey}
                  >
                    {granularity === 'hour' &&
                      n > 24 &&
                      i > 0 &&
                      new Date(bin.start).getHours() === 0 && (
                        <span aria-hidden="true" className={styles.dayLine} />
                      )}
                    {marks && bin.critical > 0 && (
                      <span aria-hidden="true" className={styles.critMark} />
                    )}
                    {marks && bin.burns > 0 && (
                      <span aria-hidden="true" className={styles.burnMark} />
                    )}
                    {bin.estimate > 0 && (
                      <span className={styles.estimate} style={{ height: pct(bin.estimate) }} />
                    )}
                    {[...keys]
                      .reverse()
                      .map((k) =>
                        bin.counts[k] ? (
                          <span
                            key={k}
                            className={styles.seg}
                            style={{ height: pct(bin.counts[k]), background: KEY_COLOR[k] }}
                          />
                        ) : null,
                      )}
                  </button>
                );
              })}
            </div>
            {desktop && grand > 0 && (
              <svg
                aria-hidden="true"
                className={styles.running}
                viewBox={`0 0 ${n} 100`}
                preserveAspectRatio="none"
              >
                <polyline points={points} vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
          <div aria-hidden="true" className={styles.labels} style={{ gap }}>
            {bins.map((bin, i) => (
              <span key={bin.start}>{binLabel(bin, i, n, granularity, desktop, today, clock)}</span>
            ))}
          </div>
        </div>
        <ul className={styles.legend} aria-label="Legend">
          {keys.map((k) => (
            <li key={k}>
              <span className={styles.swatch} style={{ background: KEY_COLOR[k] }} />
              {KEY_LABEL[k]}
            </li>
          ))}
          {estimateTotal > 0 && (
            <li>
              <span className={`${styles.swatch} ${styles.swatchEstimate}`} />
              From new lessons (estimate)
            </li>
          )}
          {marks && (
            <>
              <li>
                <span className={`${styles.dot} ${styles.dotCrit}`} />
                Level-critical
              </li>
              <li>
                <span className={`${styles.dot} ${styles.dotBurn}`} />
                Burn reviews
              </li>
            </>
          )}
          {desktop && (
            <li>
              <span className={styles.swatchLine} />
              Running total
            </li>
          )}
        </ul>
      </div>

      {b && (
        <Grow className={styles.selection}>
          <div aria-live="polite" className={styles.selText}>
            {desktop && <span className={styles.selLabel}>Selected</span>}
            <div className={styles.selHead}>
              <span>{binTitle(b, sel, granularity, today, clock)}</span>
              <span className={styles.selTotal}>
                {desktop
                  ? (b.total + b.estimate).toLocaleString()
                  : plural(b.total + b.estimate, 'review')}
              </span>
            </div>
            {desktop ? (
              <dl className={styles.selRows}>
                {keys.map((k) => (
                  <div key={k}>
                    <dt>
                      <span className={styles.swatch} style={{ background: KEY_COLOR[k] }} />
                      {KEY_LABEL[k]}
                    </dt>
                    <dd>{(b.counts[k] ?? 0).toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>{keys.map((k) => `${KEY_LABEL[k]} ${b.counts[k] ?? 0}`).join(', ')}</p>
            )}
            <p className={styles.selExtras}>{extras(b).length > 0 && `${extras(b).join(', ')}.`}</p>
            {desktop && (
              <p>Running total {(b.runningTotal + b.runningEstimate).toLocaleString()}.</p>
            )}
          </div>
          <SelectionItems ids={b.subjectIds} data={data} />
        </Grow>
      )}
    </div>
  );
}

/** Eases its height to its content's (150ms; the global reduced-motion rule turns it off). */
function Grow({ className, children }: { className: string; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={styles.grow} style={{ height }}>
      <div ref={inner} className={className}>
        {children}
      </div>
    </div>
  );
}

function SelectionItems({ ids, data }: { ids: number[]; data: TimelineData }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = ids
    .map((id) => ({ id, ...data.items.get(id) }))
    .filter((it) => it.char !== undefined)
    .sort((a, b) => Number(b.critical) - Number(a.critical) || a.stage! - b.stage!);
  return (
    <>
      <ul className={styles.items} aria-label={`${plural(items.length, 'item')} in this slot`}>
        {items.map((it) => (
          <li key={it.id}>
            <Tile
              char={it.char!}
              srsStage={it.stage}
              size={30}
              mark={it.critical ? 'critical' : undefined}
              aria-label={`${it.char}, ${stageName(it.stage ?? null)}${it.critical ? ', level-critical' : ''}`}
              onClick={() => setOpen(it.id)}
            />
          </li>
        ))}
      </ul>
      <ItemSheet subject={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function LessonsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  const [perDay, setPerDay] = usePref('lessonsPerDay');
  return (
    <div className={styles.toggle}>
      <span className={styles.perDay}>
        <label htmlFor={id}>Add</label>
        <label htmlFor={`${id}n`} className="visually-hidden">
          Lessons a day
        </label>
        <Stepper
          id={`${id}n`}
          label="Lessons a day"
          value={perDay}
          min={0}
          max={100}
          onChange={(v) => void setPerDay(v)}
        />
        <label htmlFor={id}>lessons a day</label>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

export const rangeTotal = (data: TimelineData | undefined) =>
  data ? plural(data.timeline.total + data.timeline.estimateTotal, 'review') : '';

/** The desktop Timeline card: title, total, lessons toggle, range control and the chart. */
export function TimelineCard({ title = 'Timeline' }: { title?: string }) {
  const id = useId();
  const [range, setRange] = useState<TimelineRange>('7d');
  const [withLessons, setWithLessons] = useState(false);
  const granularity = granularityFor(range, true);
  const data = useTimelineData(range, granularity, withLessons);
  return (
    <section aria-labelledby={id} className={styles.wideCard}>
      <div className={styles.wideHead}>
        <div className={styles.wideTitle}>
          <h2 id={id}>{title}</h2>
          {data && <span>{rangeTotal(data)} in range</span>}
        </div>
        <div className={styles.wideControls}>
          <LessonsToggle checked={withLessons} onChange={setWithLessons} />
          <SegmentedControl label="Range" options={RANGES} value={range} onChange={setRange} />
        </div>
      </div>
      {data ? (
        <TimelineChart key={range} data={data} granularity={granularity} desktop />
      ) : (
        <p className={styles.loading}>Loading reviews</p>
      )}
    </section>
  );
}
