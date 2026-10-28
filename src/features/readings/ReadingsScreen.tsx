import { lazy, Suspense, useMemo, useState } from 'react';
import { buttonClass } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Tile } from '../../components/Tile';
import { useAssignments, useReviewStatistics, useSubjects } from '../../db/hooks';
import { readingLeeches, type ReadingLeech } from '../../domain/onyomi';
import { plural } from '../../format';
import { stageName } from '../coverage/stage';
import styles from './Readings.module.css';

// Pulls in wanakana, so it loads only when a drill starts.
const ReadingDrill = lazy(() => import('./ReadingDrill'));

/** Kanji whose on'yomi keeps slipping, each with a word that uses it. */
export function ReadingsScreen() {
  const subjects = useSubjects();
  const assignments = useAssignments();
  const stats = useReviewStatistics();
  const [drilling, setDrilling] = useState<ReadingLeech[] | null>(null);
  const report = useMemo(
    () => subjects && assignments && stats && readingLeeches({ subjects, assignments, stats }),
    [subjects, assignments, stats],
  );

  return (
    <>
      <ScreenHeader title="On'yomi drill" />
      {!report ? (
        <p className={styles.empty}>Loading kanji</p>
      ) : report.kanji === 0 ? (
        <p className={styles.empty}>Kanji appear here once you have reviewed some.</p>
      ) : (
        <>
          <p className={styles.headline}>
            {report.readingIncorrect.toLocaleString()} reading errors vs{' '}
            {report.meaningIncorrect.toLocaleString()} meaning errors across{' '}
            {plural(report.kanji, 'kanji', 'kanji')}.
          </p>
          {report.leeches.length === 0 ? (
            <p className={styles.empty}>No kanji with on&apos;yomi trouble right now.</p>
          ) : (
            <>
              <ol className={styles.list}>
                {report.leeches.map((l) => (
                  <li key={l.subjectId}>
                    <details>
                      <summary className={styles.row}>
                        <Tile char={l.characters} srsStage={l.srsStage} size={40} />
                        <span className={styles.text}>
                          <span className={styles.meaning}>
                            {l.meaning} <span lang="ja">{l.targetReadings.join('、')}</span>
                          </span>
                          <span>
                            {Math.round(l.readingAccuracy * 100)}% reading accuracy ·{' '}
                            {plural(l.readingIncorrect, 'miss', 'misses')} · {stageName(l.srsStage)}
                          </span>
                        </span>
                      </summary>
                      <p className={styles.anchor}>
                        {l.anchor ? <AnchorLine leech={l} /> : 'No compound word found.'}
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={`${buttonClass('primary')} ${styles.drill}`}
                onClick={() => setDrilling(report.leeches)}
              >
                Drill {plural(report.leeches.length, 'kanji', 'kanji')}
              </button>
            </>
          )}
        </>
      )}
      {drilling && (
        <Suspense>
          <ReadingDrill leeches={drilling} onClose={() => setDrilling(null)} />
        </Suspense>
      )}
    </>
  );
}

export function AnchorLine({ leech: { anchor } }: { leech: ReadingLeech }) {
  if (!anchor) return null;
  return (
    <>
      <span lang="ja">
        {anchor.characters} ({anchor.reading})
      </span>{' '}
      · {anchor.meaning}
    </>
  );
}
