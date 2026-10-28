import { Link } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { buttonClass } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ItemSheet } from '../../components/ItemSheet';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Select } from '../../components/Select';
import {
  useAssignments,
  useReviewStatistics,
  useSnapshotDeltas,
  useSnapshots,
  useSubjects,
} from '../../db/hooks';
import { accuracy, type AccuracyReport } from '../../domain/accuracy';
import {
  buildItems,
  filterItems,
  PRESETS,
  presetCounts,
  type Item,
  type Preset,
} from '../../domain/items';
import { leeches } from '../../domain/leeches';
import { useNow } from '../../hooks/useNow';
import { plural } from '../../format';
import { AccuracySummary } from './AccuracySummary';
import { ItemList, type GroupBy, type SortBy } from './ItemList';
import styles from './Items.module.css';

// Pulls in wanakana, so it loads only when a drill starts.
const Drill = lazy(() => import('./Drill'));

const PRESET_LABEL: Record<Preset, string> = {
  leeches: 'Leeches',
  apprentice: 'Apprentice',
  next24h: 'Next 24h',
  guru: 'Guru',
  burned: 'Burned',
};

export function ItemsScreen() {
  const subjects = useSubjects();
  const assignments = useAssignments();
  const stats = useReviewStatistics();
  const snapshots = useSnapshots();
  const deltas = useSnapshotDeltas();
  const now = useNow();

  const data = useMemo(() => {
    if (!subjects || !assignments || !stats || !snapshots || !deltas) return undefined;
    const leechReport = leeches({ subjects, assignments, stats, snapshots, deltas, now });
    const items = buildItems({ subjects, assignments, stats, leeches: leechReport.leeches, now });
    return {
      items,
      started: items.filter((i) => i.daysIn !== null).length,
      accuracy: accuracy(stats, snapshots, deltas, now),
      recentLeeches: leechReport.recentAvailable,
    };
  }, [subjects, assignments, stats, snapshots, deltas, now]);

  return (
    <>
      <ScreenHeader title="Items" aside={data && `${data.started.toLocaleString()} started`} />
      {!data ? (
        <p className={styles.empty}>Loading items</p>
      ) : data.items.length === 0 ? (
        <p className={styles.empty}>Items appear here after the first sync.</p>
      ) : (
        <ItemsView {...data} now={now} />
      )}
    </>
  );
}

interface ViewProps {
  items: Item[];
  accuracy: AccuracyReport;
  /** 14 days of snapshots exist, so leeches split into recently struggling and the rest. */
  recentLeeches: boolean;
  now: number;
}

export function ItemsView({ items, accuracy, recentLeeches, now }: ViewProps) {
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState<Preset | null>('leeches');
  const [group, setGroup] = useState<Exclude<GroupBy, 'section'>>('none');
  const [sort, setSort] = useState<SortBy>('leechScore');
  const [selected, setSelected] = useState<number | null>(null);
  const [visible, setVisible] = useState<Item[]>([]);
  const [copied, setCopied] = useState<{ text: string; list: Item[] }>();
  const [drilling, setDrilling] = useState<Item[] | null>(null);
  const [toKana, setToKana] = useState<(s: string) => string>();

  // Romaji search needs wanakana; fetch it only once someone types latin letters.
  const wantsKana = /[a-z]/i.test(query);
  useEffect(() => {
    if (wantsKana && !toKana)
      void import('wanakana').then((w) => setToKana(() => (s: string) => w.toHiragana(s)));
  }, [wantsKana, toKana]);

  const deferredQuery = useDeferredValue(query);
  const counts = useMemo(() => presetCounts(items, now), [items, now]);
  const shown = useMemo(
    () => filterItems(items, preset, deferredQuery, now, toKana),
    [items, preset, deferredQuery, now, toKana],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const groupBy: GroupBy =
    group === 'none' && preset === 'leeches' && recentLeeches ? 'section' : group;

  const copy = useCallback(async () => {
    const chars = visible.flatMap((i) => i.characters ?? []);
    try {
      await navigator.clipboard.writeText(chars.join('\n'));
      setCopied({
        text: `Copied ${chars.length} ${chars.length === 1 ? 'item' : 'items'}`,
        list: visible,
      });
    } catch {
      setCopied({ text: "Couldn't copy. The browser blocked clipboard access.", list: visible });
    }
  }, [visible]);

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.search}>
          <label htmlFor="items-q" className="visually-hidden">
            Search items
          </label>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            id="items-q"
            type="search"
            placeholder="Kanji, kana, or meaning"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Views" className={styles.presets}>
          {PRESETS.map((p) => (
            <Chip key={p} pressed={preset === p} onClick={() => setPreset(preset === p ? null : p)}>
              {PRESET_LABEL[p]} {counts[p].toLocaleString()}
            </Chip>
          ))}
        </div>
        <div className={styles.selects}>
          <label htmlFor="items-group">Group</label>
          <Select
            id="items-group"
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            <option value="none">None</option>
            <option value="level">Level</option>
            <option value="type">Type</option>
            <option value="stage">SRS stage</option>
          </Select>
          <label htmlFor="items-sort">Sort</label>
          <Select id="items-sort" value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
            <option value="leechScore">Leech score</option>
            <option value="level">Level</option>
            <option value="accuracy">Accuracy</option>
            <option value="next">Next review</option>
          </Select>
        </div>
      </div>

      <AccuracySummary report={accuracy} />

      {preset === 'leeches' && <LeechExplainer recent={recentLeeches} />}

      {shown.length === 0 ? (
        <p className={styles.empty}>
          {preset === 'leeches' && !query ? 'No leeches right now.' : 'No items match.'}
        </p>
      ) : (
        <ItemList
          items={shown}
          byId={byId}
          groupBy={groupBy}
          sortBy={sort}
          showNext={preset === 'next24h' || sort === 'next'}
          now={now}
          onOpen={(i) => setSelected(i.id)}
          onOrder={setVisible}
        />
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${buttonClass('primary')} ${styles.drill}`}
          onClick={() => setDrilling(visible)}
          disabled={shown.length === 0}
        >
          Drill {plural(visible.length, 'item')}
        </button>
        <button
          type="button"
          className={buttonClass('secondary')}
          onClick={copy}
          disabled={shown.length === 0}
        >
          Copy list
        </button>
      </div>
      <p role="status" className={styles.note}>
        {copied?.list === visible ? copied.text : ''}
      </p>

      <ItemSheet subject={selected} byId={byId} onClose={() => setSelected(null)} />
      {drilling && (
        <Suspense>
          <Drill items={drilling} onClose={() => setDrilling(null)} />
        </Suspense>
      )}
    </>
  );
}

function LeechExplainer({ recent }: { recent: boolean }) {
  return (
    <div className={styles.explainer}>
      <p>
        Items you keep missing, worst first. Anything from the last 7 days of lessons is skipped,
        since early misses are normal.
      </p>
      <p>
        Mostly missing kanji readings? <Link to="/readings">Drill on&apos;yomi</Link>
      </p>
      <details>
        <summary>How the score works</summary>
        <p>
          Wrong answers (meaning and reading together) divided by the current streak to the power of
          1.5. The streak is the shorter of the meaning and reading streaks, and at least 1. A score
          of 1 or more makes a leech. Burned items don't count.
        </p>
        {!recent && (
          <p>
            Once there are 14 days of snapshots, items missed in the last two weeks move to the top
            under Recently struggling.
          </p>
        )}
      </details>
    </div>
  );
}
