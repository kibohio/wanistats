import { Card } from '../../components/Card';
import { Tile } from '../../components/Tile';
import type { LevelUpKanji } from '../../domain/levelUp';
import type { LevelUpGroup } from '../../domain/today';
import { Explain } from './Explain';
import { clock, dayDate, plural, shortWhen, stageName, when, word } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

const charOf = (d: TodayData, id: number) => {
  const s = d.subjectById.get(id);
  return s?.data.characters ?? s?.data.slug ?? '?';
};

function groupWhen(g: LevelUpGroup, now: number) {
  if (g.kind === 'lesson') return 'In lessons';
  if (g.kind === 'locked') return 'Locked';
  return when(g.at!, now);
}

function groupStage(g: LevelUpGroup) {
  if (g.kind === 'lesson') return 'Not started';
  if (g.kind === 'locked') return 'Waiting on radicals';
  return stageName(g.stage);
}

function tileLabel(k: LevelUpKanji, now: number) {
  if (k.passed) return stageName(k.stage).replace(/ \d$/, '');
  if (k.locked) return 'Locked';
  if (!k.stage) return 'Lesson';
  return shortWhen(k.nextReviewAt ?? now, now);
}

function KanjiList({ d, kanji }: { d: TodayData; kanji: LevelUpKanji[] }) {
  return (
    <ul className={styles.itemList}>
      {kanji.map((k) => (
        <li key={k.subjectId}>
          <Tile char={charOf(d, k.subjectId)} srsStage={k.stage ?? undefined} size={30} />
          <span>{stageName(k.stage)}</span>
          <span className={styles.itemMeta}>
            {k.passed ? 'Passed' : `Guru ${when(k.earliestGuruAt, d.now)} at the earliest`}
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
            Level {p.level} has {plural(p.total, 'kanji', 'kanji')}. WaniKani moves on to the next
            level when 90% of them, rounded up, reach Guru: {p.needed}. {p.passed} have passed so
            far.
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
            {p.needed} of {p.total} kanji need to reach Guru and {p.passed} have. Each of the other{' '}
            {p.unpassed} gets its earliest Guru time, assuming every answer is right and every
            review is done the moment it comes back. Times are truncated to the hour, as WaniKani
            does.
          </p>
          <p>
            The level-up is the {p.k === 1 ? 'first' : `${p.k}th earliest`} of those times. These{' '}
            {p.k} set the date:
          </p>
          <KanjiList d={d} kanji={d.ordered.filter((k) => k.critical)} />
          {d.vacation && <p>Vacation mode is on, so the time left is frozen until it ends.</p>}
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
            Only {p.k} of the {p.unpassed} kanji left are needed. Every one of them can reach Guru
            by {dayDate(p.earliestAt)} {clock(p.earliestAt)}, so any {p.slack} can slip without
            moving the date.
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
        Level {d.maxLevel} is the highest this subscription grants, so there is no next level-up.
      </p>
    );
  }
  if (p.status === 'ready') {
    return (
      <div className={styles.dateRow}>
        <span className={styles.date}>Ready now</span>
        <span className={styles.dateSub}>
          Enough kanji are at Guru. The level-up shows after the next sync.
        </span>
      </div>
    );
  }
  return (
    <div className={styles.dateRow}>
      <DateExplain d={d}>
        <span className={styles.date}>
          {dayDate(p.earliestAt)}
          {desktop && `, ${clock(p.earliestAt)}`}
        </span>
      </DateExplain>
      <span className={styles.dateSub}>
        {desktop ? 'at the earliest' : `${clock(p.earliestAt)} at the earliest`}
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
          {p.passed} of {p.needed} kanji at Guru
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
                <span className={styles.groupWhen}>{groupWhen(g, d.now)}</span>
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

/** "The date rests on the 18:00 group: two of those five need to pass three reviews in a row." */
function restsOn(d: TodayData): string | null {
  const g = d.groups.find((x) => x.decisive);
  if (!g) return null;
  const n = g.subjectIds.length;
  const c = g.critical;
  const who =
    n === 1 ? 'it needs' : c === n ? `all ${word(n)} need` : `${word(c)} of those ${word(n)} need`;
  const reviews = `${word(g.reviewsToGuru)} ${g.reviewsToGuru === 1 ? 'review' : 'reviews'} in a row`;
  if (g.kind === 'lesson')
    return `The date rests on kanji still in lessons: ${who} a lesson, then ${reviews}.`;
  if (g.kind === 'locked')
    return `The date rests on locked kanji: ${who} their radicals at Guru first, then a lesson and ${reviews}.`;
  const at = g.at! <= d.now ? 'overdue' : shortWhen(g.at!, d.now);
  return `The date rests on the ${at} group: ${who} to pass ${reviews}.`;
}

export function LevelUpCardDesktop({ d }: { d: TodayData }) {
  const { levelUp: p, radicals } = d;
  const own = d.sample ? 'the' : 'your';
  const rests = restsOn(d);
  const slackLine =
    p.slack > 0 &&
    (p.slack === 1
      ? `The faded tile is ${own} slack.`
      : `The ${word(p.slack)} faded tiles are ${own} slack.`);
  return (
    <Card
      className={styles.levelUpDesktop}
      title="Next level-up"
      aside={
        <span className={styles.asideStrong}>
          {radicals.total > 0 &&
            (radicals.passed === radicals.total
              ? 'Radicals done. '
              : `${radicals.passed} of ${radicals.total} radicals at Guru. `)}
          <CountExplain d={d}>
            {p.passed} of {p.needed} kanji at Guru
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
          const label = tileLabel(k, d.now);
          const name = `${char}, ${stageName(k.stage)}${!k.passed && k.stage ? `, next review ${label}` : ''}${slack ? ', not needed for level-up' : ''}`;
          return (
            <div
              key={k.subjectId}
              className={styles.tileCell}
              title={name}
              role="img"
              aria-label={name}
            >
              <Tile
                char={char}
                srsStage={k.stage ?? undefined}
                size={46}
                mark={k.critical ? 'critical' : slack ? 'slack' : undefined}
              />
              <span className={slack ? styles.tileLabelFaded : styles.tileLabel}>{label}</span>
            </div>
          );
        })}
      </div>
      {p.status !== 'capped' && p.status !== 'ready' && (rests || slackLine) && (
        <p className={styles.para}>{[rests, slackLine].filter(Boolean).join(' ')}</p>
      )}
    </Card>
  );
}
