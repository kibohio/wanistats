import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { Tile } from '../../components/Tile';
import type { AccuracyFigures } from '../../domain/accuracy';
import { coverageSummary } from '../../domain/today';
import { PackEmptyState } from '../packs/PackPrompts';
import { usePack } from '../../packs/hooks';
import { SAMPLE_COVERAGE_LABEL, sampleKanji } from '../../packs/sampleCoverage';
import { Explain } from './Explain';
import { int, pct, stageName } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

export function CoverageCard({ d }: { d: TodayData }) {
  const installed = usePack('kanji');
  const pack = installed ?? (d.sample ? sampleKanji : null);
  const c = useMemo(
    () => (pack ? coverageSummary(d.subjects, d.assignments, pack) : null),
    [pack, d.subjects, d.assignments],
  );
  return (
    <Card
      className={styles.summary}
      title="Kanji known, by JLPT level"
      aside={
        <Link to="/kanji" className={styles.link}>
          Open map
        </Link>
      }
    >
      {installed === undefined ? null : !c ? (
        <PackEmptyState packId="kanji">
          Coverage by JLPT level and Jōyō grade needs the kanji data.
        </PackEmptyState>
      ) : (
        <>
          {!installed && <p className={styles.sampleLabel}>{SAMPLE_COVERAGE_LABEL}</p>}
          {c.jlpt.map((g) => (
            <Explain
              key={g.key}
              className={styles.covRow}
              title={`${g.label} kanji`}
              explain={
                <p>
                  {g.known} of {g.total} {g.label} kanji have passed Guru. JLPT lists are
                  unofficial; kanji outside WaniKani count as not known.
                </p>
              }
            >
              <span className={styles.covName}>{g.label}</span>
              <span className={styles.covTrack}>
                <span className={styles.covBar} style={{ width: `${g.pct}%` }} />
              </span>
              <span className={styles.covPct}>{Math.round(g.pct)}%</span>
            </Explain>
          ))}
          <div className={styles.pair}>
            <Explain
              title="Jōyō kanji"
              explain={
                <p>
                  {int(c.joyo.known)} of the {int(c.joyo.total)} Jōyō kanji have passed Guru.
                </p>
              }
            >
              <span className={styles.pairFigure}>{Math.round(c.joyo.pct)}%</span>
              <span className={styles.pairLabel}>of the {int(c.joyo.total)} Jōyō</span>
            </Explain>
            <Explain
              title="Weighted coverage"
              explain={
                <p>
                  Each kanji counts by how often it appears in Jiten&apos;s corpus. Jiten publishes
                  ranks, not counts, so the weight is 1 ÷ rank (Zipf&apos;s law) and the figure is
                  an estimate. Known means passed Guru at least once.
                </p>
              }
            >
              <span className={styles.pairFigure}>{Math.round(c.weighted.pct)}%</span>
              <span className={styles.pairLabel}>
                of kanji appearances in Jiten&apos;s corpus, estimated
              </span>
            </Explain>
          </div>
        </>
      )}
    </Card>
  );
}

export function LeechesCard({ d }: { d: TodayData }) {
  const list = d.leeches.leeches;
  const stageOf = new Map(d.assignments.map((a) => [a.data.subject_id, a.data.srs_stage]));
  const label = (id: number) => {
    const s = d.subjectById.get(id);
    return s?.data.characters ?? s?.data.slug ?? '?';
  };
  return (
    <Card
      className={styles.summary}
      title="Top leeches"
      aside={
        list.length > 0 && (
          <Link to="/items" className={styles.link}>
            All {list.length}
          </Link>
        )
      }
    >
      {list.length === 0 ? (
        <p className={styles.note}>No leeches right now.</p>
      ) : (
        <ul className={styles.leeches}>
          {list.slice(0, 5).map((l) => {
            const s = d.subjectById.get(l.subjectId);
            const stage = stageOf.get(l.subjectId) ?? 0;
            const ch = label(l.subjectId);
            const like = l.lookAlikeIds[0];
            return (
              <li key={l.subjectId}>
                <Tile
                  char={ch}
                  srsStage={stage}
                  size={40}
                  className={ch.length > 1 ? styles.wide : ''}
                />
                <span className={styles.leechText}>
                  <span className={styles.leechMeaning}>
                    {s?.data.meanings.find((m) => m.primary)?.meaning}
                  </span>
                  <span className={styles.leechSub}>
                    {stageName(stage)}
                    {like !== undefined && `, often mixed with ${label(like)}`}
                  </span>
                </span>
                <Explain
                  className={styles.leechWrong}
                  title={`Leech: ${ch}`}
                  explain={
                    <p>
                      {l.incorrect} wrong answers in total. Leech score = wrong answers ÷ shortest
                      current streak<sup>1.5</sup> = {l.score.toFixed(1)}. Items scoring 1 or more,
                      not burned and learned over a week ago are leeches.
                      {l.recentMisses !== null &&
                        ` Missed ${l.recentMisses} times in the last 14 days.`}
                    </p>
                  }
                >
                  {l.incorrect} wrong
                </Explain>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const ROWS: ['radical' | 'kanji' | 'vocabulary' | 'kana_vocabulary', string][] = [
  ['radical', 'Radicals'],
  ['kanji', 'Kanji'],
  ['vocabulary', 'Vocabulary'],
  ['kana_vocabulary', 'Kana vocabulary'],
];

export function AccuracyCard({ d }: { d: TodayData }) {
  const recent = d.accuracy.recent30;
  const a = recent ?? d.accuracy.lifetime;
  const span = recent ? 'the last 30 days of snapshots' : 'all reviews so far';
  const explainQ = (f: AccuracyFigures) => (
    <p>
      Correct answers ÷ all answers, meaning and reading scored apart, over {span}: {int(f.answers)}{' '}
      answers.
    </p>
  );
  return (
    <Card
      className={styles.summary}
      title={recent ? 'Accuracy, last 30 days' : 'Accuracy, lifetime'}
    >
      <div className={styles.pair}>
        <Explain title="Question accuracy" explain={explainQ(a)}>
          <span className={styles.accFigure}>{pct(a.question)}</span>
          <span className={styles.pairLabel}>Questions, meaning and reading scored apart</span>
        </Explain>
        <Explain
          title="Item accuracy"
          explain={
            <p>
              Per item, meaning rate × reading rate, weighted by its reviews, over {span}. WaniKani
              keeps totals, not single reviews, so this is an estimate of items with both parts
              right.
            </p>
          }
        >
          <span className={styles.accFigure}>{pct(a.itemEstimate)}</span>
          <span className={styles.pairLabel}>Items, both parts right, estimated</span>
        </Explain>
      </div>
      <table className={styles.accTable}>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Meaning</th>
            <th scope="col">Reading</th>
            <th scope="col">Item</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.filter(([t]) => t !== 'kana_vocabulary' || a.bySubjectType[t].answers > 0).map(
            ([t, name]) => {
              const f = a.bySubjectType[t];
              return (
                <tr key={t}>
                  <th scope="row">{name}</th>
                  <td>{pct(f.meaning)}</td>
                  <td className={f.reading === null ? styles.muted : ''}>{pct(f.reading)}</td>
                  <td className={styles.strong}>{pct(f.itemEstimate)}</td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
      {!recent && <p className={styles.note}>Recent accuracy appears after a week of daily use.</p>}
    </Card>
  );
}
