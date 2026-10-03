import { useState } from 'react';
import { Card } from '../../components/Card';
import { ItemSheet } from '../../components/ItemSheet';
import { Tile } from '../../components/Tile';
import type { LevelUpKanji } from '../../domain/levelUp';
import type { LevelUpGroup } from '../../domain/today';
import { Explain } from './Explain';
import { formatTime } from '../../format';
import { dayDate, plural, shortWhen, stageName, when, word } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const charOf = (d: TodayData, id: number) => {
  const s = d.subjectById.get(id);
  return s?.data.characters ?? s?.data.slug ?? '?';
};

function groupWhen(g: LevelUpGroup, d: TodayData) {
  if (g.kind === 'lesson') return 'In lessons';
  if (g.kind === 'locked') return 'Locked';
  return when(g.at!, d.now, d.clock);
}

function groupStage(g: LevelUpGroup) {
  if (g.kind === 'lesson') return 'Not started';
  if (g.kind === 'locked') return 'Waiting on radicals';
  return stageName(g.stage);
}

// Passed tiles carry no caption: the tile colour shows it and the accessible name says it.
function tileLabel(k: LevelUpKanji, d: TodayData) {
  if (k.passed) return null;
  if (k.locked) return 'Locked';
  if (!k.stage) return 'Lesson';
  return shortWhen(k.nextReviewAt ?? d.now, d.now, d.clock, true);
}

function KanjiList({ d, kanji }: { d: TodayData; kanji: LevelUpKanji[] }) {
  return (
    <ul className={styles.itemList}>
      {kanji.map((k) => (
        <li key={k.subjectId}>
          <Tile char={charOf(d, k.subjectId)} srsStage={k.stage ?? undefined} size={30} />
          <span>{stageName(k.stage)}</span>
          <span className={styles.itemMeta}>
            {k.passed ? 'Passed' : `Guru ${when(k.earliestGuruAt, d.now, d.clock)} at the earliest`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CountExplain({ d, children }: { d: TodayData; children: React.ReactNode }) {
  const { levelUp: p } = d;
  return (
    <Explain
      title="Kanji at Guru"
      explain={
        <>
          <p>
            Level {p.level} has {plural(p.total, 'kanji', 'kanji')}. You level up when 90% of them (
            {p.needed}) reach Guru. {p.passed} are there so far.
          </p>
          <KanjiList d={d} kanji={d.ordered.filter((k) => k.passed)} />
        </>
      }
    >
      {children}
    </Explain>
  );
}

function DateExplain({ d, children }: { d: TodayData; children: React.ReactNode }) {
  const { levelUp: p } = d;
  return (
    <Explain
      title="Next level-up"
      explain={
        <>
          <p>
            You need {p.needed} of {p.total} kanji at Guru and have {p.passed}. This date assumes
            you answer every review right as soon as it comes up. Review times round down to the
            hour, as on WaniKani.
          </p>
          <p>
            {p.k === 1
              ? 'One more kanji gets you there. This one can make it first:'
              : `${cap(word(p.k))} more kanji get you there. These ${word(p.k)} can make it first:`}
          </p>
          <KanjiList d={d} kanji={d.ordered.filter((k) => k.critical)} />
          {d.vacation && <p>Vacation mode is on, so the clock is paused until it ends.</p>}
        </>
      }
    >
      {children}
    </Explain>
  );
}

function SlackExplain({ d }: { d: TodayData }) {
  const { levelUp: p } = d;
  return (
    <Explain
      className={styles.slack}
      title="Room to miss"
      explain={
        <>
          <p>
            You need {p.k} of the {p.unpassed} kanji left. All of them can reach Guru by{' '}
            {dayDate(p.earliestAt)} {formatTime(p.earliestAt, d.clock)}, so any {p.slack} can slip
            and the date stays put.
          </p>
          <KanjiList d={d} kanji={d.ordered.filter((k) => !k.passed && !k.critical)} />
        </>
      }
    >
      Miss up to {p.slack} of these {p.unpassed} and the date holds.
    </Explain>
  );
}

/** Big date line; "ready" and "capped" replace it. */
function DateLine({ d, desktop }: { d: TodayData; desktop?: boolean }) {
  const { levelUp: p } = d;
  if (p.status === 'capped') {
    return (
      <p className={styles.note}>
        This subscription stops at level {d.maxLevel}, so there&apos;s no next level-up.
      </p>
    );
  }
  if (p.status === 'ready') {
    return (
      <div className={styles.dateRow}>
        <span className={styles.date}>Ready now</span>
        <span className={styles.dateSub}>
          Enough kanji are at Guru. Refresh to pick up the new level.
        </span>
      </div>
    );
  }
  return (
    <div className={styles.dateRow}>
      <DateExplain d={d}>
        <span className={styles.date}>
          {dayDate(p.earliestAt)}
          {desktop && `, ${formatTime(p.earliestAt, d.clock)}`}
        </span>
      </DateExplain>
      <span className={styles.dateSub}>
        {desktop ? 'at the earliest' : `${formatTime(p.earliestAt, d.clock)} at the earliest`}
      </span>
    </div>
  );
}

function Strip({ d }: { d: TodayData }) {
  const { levelUp: p, ordered } = d;
  const apprentice = ordered.filter((k) => !k.passed && k.stage).length;
  const lessons = ordered.filter((k) => k.stage === 0).length;
  const locked = ordered.filter((k) => k.locked).length;
  const parts = [
    `${p.passed} at Guru`,
    apprentice && `${apprentice} still in Apprentice`,
    lessons && `${lessons} in lessons`,
    locked && `${locked} locked`,
  ].filter(Boolean);
  return (
    <div
      role="img"
      aria-label={`${p.total} kanji on this level: ${parts.join(', ')}. ${p.needed} needed.`}
      className={styles.strip}
    >
      {ordered.map((k, i) => (
        <span
          key={k.subjectId}
          className={`${styles.square} ${i === p.needed - 1 ? styles.threshold : ''}`}
          style={{ background: squareColor(k) }}
        />
      ))}
    </div>
  );
}

const squareColor = (k: LevelUpKanji) =>
  k.passed ? 'var(--srs-guru)' : k.stage ? `var(--srs-a${Math.min(k.stage, 4)})` : 'var(--control)';

export function LevelUpCard({ d }: { d: TodayData }) {
  const { levelUp: p } = d;
  return (
    <Card
      title="Next level-up"
      aside={
        <CountExplain d={d}>
          {p.passed} of {p.total} kanji at Guru
        </CountExplain>
      }
    >
      <DateLine d={d} />
      {p.total > 0 && <Strip d={d} />}
      {d.groups.length > 0 && (
        <div className={styles.groups}>
          {d.groups.map((g) => (
            <div key={`${g.kind}${g.at}${g.stage}`} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupWhen}>{groupWhen(g, d)}</span>
                <span className={styles.groupStage}>{groupStage(g)}</span>
              </div>
              <div className={styles.groupTiles}>
                {g.subjectIds.map((id) => (
                  <Tile key={id} char={charOf(d, id)} srsStage={g.stage ?? undefined} size={30} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {p.slackHolds && <SlackExplain d={d} />}
    </Card>
  );
}

/** "Two kanji due at 4 PM decide this. Each needs three more correct reviews." */
function decider(d: TodayData): string | null {
  const g = d.groups.find((x) => x.decisive);
  if (!g) return null;
  const n = g.subjectIds.length;
  const c = g.critical;
  const one = c === 1;
  const t = g.at === null ? '' : shortWhen(g.at, d.now, d.clock, true);
  const where =
    g.kind === 'lesson'
      ? 'still in lessons'
      : g.kind === 'locked'
        ? 'still locked'
        : t === 'Now'
          ? 'due now'
          : // Today's times read "due at 4 PM", later ones "due Sun 9 AM".
            `due ${/^\d/.test(t) ? 'at ' : ''}${t}`;
  const who =
    c === n ? `${cap(word(n))} kanji ${where}` : `${cap(word(c))} of the ${word(n)} kanji ${where}`;
  const reviews = `${word(g.reviewsToGuru)} correct ${g.reviewsToGuru === 1 ? 'review' : 'reviews'}`;
  const need =
    g.kind === 'lesson'
      ? `${one ? 'It' : 'Each'} needs a lesson, then ${reviews}.`
      : g.kind === 'locked'
        ? `${one ? 'Its' : 'Their'} radicals need to reach Guru first, then a lesson and ${reviews}.`
        : `${one ? 'It' : 'Each'} needs ${reviews.replace(' correct', ' more correct')}.`;
  return `${who} ${one ? 'decides' : 'decide'} this. ${need}`;
}

export function LevelUpCardDesktop({ d }: { d: TodayData }) {
  const { levelUp: p, radicals } = d;
  const [open, setOpen] = useState<number | null>(null);
  const why = decider(d);
  const slackLine =
    p.slack > 0 &&
    (p.slack === 1
      ? 'You can miss one other (the faded tile).'
      : `You can miss up to ${word(p.slack)} others (the faded tiles).`);
  const info = p.status !== 'capped' && p.status !== 'ready' && (why || slackLine) && (
    <p>{[why, slackLine].filter(Boolean).join(' ')}</p>
  );
  return (
    <Card
      className={styles.levelUpDesktop}
      title="Next level-up"
      info={info}
      aside={
        <span>
          {radicals.total > 0 &&
            (radicals.passed === radicals.total
              ? 'Radicals done. '
              : `${radicals.passed} of ${radicals.total} radicals at Guru. `)}
          <CountExplain d={d}>
            {p.passed} of {p.total} kanji at Guru
            {p.slack > 0 && p.k > 0 && `, ${p.slack} to spare`}.
          </CountExplain>
        </span>
      }
    >
      <DateLine d={d} desktop />
      <div className={styles.tiles}>
        {d.ordered.map((k) => {
          const slack = !k.passed && !k.critical;
          const char = charOf(d, k.subjectId);
          const label = tileLabel(k, d);
          const name = k.passed
            ? `${char}, ${stageName(k.stage).replace(/ \d$/, '')}, passed`
            : `${char}, ${stageName(k.stage)}${k.stage ? `, next review ${label}` : ''}${slack ? ', not needed for level-up' : ''}`;
          return (
            <div key={k.subjectId} className={styles.tileCell} title={name}>
              <Tile
                char={char}
                srsStage={k.stage ?? undefined}
                size={46}
                mark={k.critical ? 'critical' : slack ? 'slack' : undefined}
                aria-label={name}
                onClick={() => setOpen(k.subjectId)}
              />
              {label && (
                <span aria-hidden="true" className={slack ? styles.tileLabelFaded : styles.tileLabel}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ItemSheet subject={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
