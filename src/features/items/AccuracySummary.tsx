import { useState } from 'react';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Sheet } from '../../components/Sheet';
import type { AccuracyReport } from '../../domain/accuracy';
import { weakestPart } from '../../domain/items';
import styles from './Items.module.css';
import { plural } from '../../format';

type Range = '7' | '30' | 'all';
const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All time' },
] as const;
const TYPE_NAME = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Kana vocabulary',
} as const;

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);

export function AccuracySummary({ report }: { report: AccuracyReport }) {
  const [range, setRange] = useState<Range>('30');
  const [open, setOpen] = useState(false);
  const shown = report.recentAvailable ? range : 'all';
  const b = shown === '7' ? report.recent7! : shown === '30' ? report.recent30! : report.lifetime;
  const weakest = weakestPart(b);
  const weakestLabel = weakest
    ? `${TYPE_NAME[weakest.type].replace(/s$/, '')} ${weakest.part}, weakest`
    : 'Weakest part';
  const scope = shown === 'all' ? 'all time' : `the last ${shown} days`;

  const figures = [
    { value: pct(b.question), label: 'Questions right' },
    { value: pct(b.itemEstimate), label: 'Items, both parts right, estimated' },
    { value: pct(weakest?.rate ?? null), label: weakestLabel },
  ];

  return (
    <section aria-label={`Accuracy, ${scope}`} className={styles.summary}>
      {report.recentAvailable && (
        <SegmentedControl
          label="Accuracy range"
          options={RANGES}
          value={range}
          onChange={setRange}
        />
      )}
      <div className={styles.figures}>
        {figures.map((f) => (
          <button
            key={f.label}
            type="button"
            className={styles.figure}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            <span className={styles.figureValue}>{f.value}</span>
            <span className={styles.figureLabel}>{f.label}</span>
          </button>
        ))}
      </div>
      {!report.recentAvailable && (
        <p className={styles.note}>Recent accuracy appears after a week of daily use.</p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="How accuracy is worked out">
        <div className={styles.sheetBody}>
          <p>
            {shown === 'all'
              ? 'All time, from the answer totals WaniKani keeps for each item.'
              : `The last ${shown} days, from the daily snapshots saved on this device.`}{' '}
            {plural(b.answers, 'answer')}.
          </p>
          <p>
            <strong>Questions right</strong> is correct answers divided by all answers, meaning and
            reading together.
          </p>
          <p>
            <strong>Items, both parts right</strong> takes each item's meaning rate times its
            reading rate (meaning only for radicals and kana vocabulary), weighted by its reviews.
            WaniKani keeps totals, not single reviews, so this is an estimate.
          </p>
          <p>
            <strong>Weakest</strong> is the lowest meaning or reading rate in the table below.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Meaning</th>
                  <th scope="col">Reading</th>
                  <th scope="col">Items, estimated</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(TYPE_NAME) as (keyof typeof TYPE_NAME)[]).map((t) => {
                  const f = b.bySubjectType[t];
                  return (
                    <tr key={t}>
                      <th scope="row">{TYPE_NAME[t]}</th>
                      <td>{pct(f.meaning)}</td>
                      <td>{pct(f.reading)}</td>
                      <td>{pct(f.itemEstimate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
