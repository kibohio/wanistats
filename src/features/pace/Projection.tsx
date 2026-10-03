import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { usePref } from '../../db/prefs';
import { projectFinish, requiredDaysPerLevel, type PaceStats } from '../../domain/pace';
import { Facts, Figure } from './Figure';
import { DAY_MS, fmtDate, fmtDateTime, fmtDays, fmtShort, fmtSpan, plural } from './format';
import styles from './Pace.module.css';

const MAX_LEVEL = 60;
const SLIDER_MIN = 3;
const SLIDER_MAX = 21;

interface Props {
  level: number;
  maxLevelGranted: number;
  earliestLevelUpAt: number;
  onVacation: boolean;
  stats: PaceStats;
  minLevelTimes: Map<number, number>;
  guruThrough: number;
  burnedThrough: number;
  now: number;
  /** 'your' when logged in, 'the sample' otherwise. */
  owner: string;
}

export function Projection(p: Props) {
  const { stats, earliestLevelUpAt: lu, owner } = p;
  const goalId = useId();
  const paceId = useId();
  const dateId = useId();
  const [goalPref, setGoal] = usePref('goalLevel');
  const [goalDate, setGoalDate] = usePref('goalDate');
  const [whatIf, setWhatIf] = useState<number | null>(null);

  const minGoal = Math.min(p.level + 1, MAX_LEVEL);
  const goal = Math.min(Math.max(goalPref, minGoal), MAX_LEVEL);
  const median = stats.medianDays;
  const isWhatIf = whatIf !== null && (median === null || Math.abs(whatIf - median) > 0.05);
  const pace = isWhatIf ? whatIf : median;
  const finish = projectFinish({
    goal,
    currentLevel: p.level,
    maxLevelGranted: p.maxLevelGranted,
    earliestLevelUpAt: lu,
    paceDays: pace ?? 0,
    p25Days: stats.p25Days,
    p75Days: stats.p75Days,
    minLevelTimes: p.minLevelTimes,
  });
  const goalAt = goalDate ? Date.parse(`${goalDate}T00:00`) : null;
  const required =
    goalAt === null
      ? null
      : requiredDaysPerLevel({
          goal: finish.goal,
          currentLevel: p.level,
          earliestLevelUpAt: lu,
          goalDate: goalAt,
        });
  const counted = stats.rows.filter((r) => r.included).length;
  const sliderValue = Math.min(Math.max(pace ?? 7, SLIDER_MIN), SLIDER_MAX);
  const between =
    finish.goal > p.level + 2
      ? `levels ${p.level + 1} to ${finish.goal - 1}`
      : `level ${p.level + 1}`;
  const levelUpRow: [string, string] = ['Next level-up, earliest', fmtDateTime(lu)];

  const goalSelect = (
    <span className={styles.goal}>
      <label htmlFor={goalId}>Goal</label>
      <select
        id={goalId}
        className={styles.select}
        value={goal}
        onChange={(e) => void setGoal(Number(e.target.value))}
      >
        {Array.from({ length: MAX_LEVEL - minGoal + 1 }, (_, i) => minGoal + i).map((l) => (
          <option key={l} value={l}>
            Level {l}
          </option>
        ))}
      </select>
    </span>
  );

  return (
    <Card title="Projected finish" aside={goalSelect}>
      {finish.capped && (
        <p className={styles.note}>
          The subscription unlocks levels up to {p.maxLevelGranted}, so this projects to level{' '}
          {finish.goal}.
        </p>
      )}
      {p.onVacation && <p className={styles.note}>On vacation. Times assume it ends now.</p>}

      {finish.reached ? (
        <p className={styles.lead}>Level {finish.goal} reached.</p>
      ) : finish.finishAt !== null && pace !== null ? (
        <Figure
          title="Projected finish"
          className={styles.finishBlock}
          explain={
            <>
              <p>The earliest next level-up, then each level after it at the pace below.</p>
              <Facts
                rows={[
                  levelUpRow,
                  ['Levels after that', String(finish.levelsLeft)],
                  [
                    'Pace',
                    isWhatIf
                      ? `${fmtDays(pace)} days a level, what-if`
                      : `${fmtDays(pace)} days a level, median of ${plural(counted, 'counted level')}`,
                  ],
                  ['Finish', `${fmtDateTime(lu)} + ${finish.levelsLeft} × ${fmtDays(pace)} days`],
                ]}
              />
            </>
          }
        >
          <span className={styles.finish}>{fmtDate(finish.finishAt)}</span>
          <span className={styles.sub}>
            {plural(Math.max(0, Math.round((finish.finishAt - p.now) / DAY_MS)), 'day')} from today
          </span>
        </Figure>
      ) : (
        <p className={styles.note}>
          A projection needs at least one passed level. Move the slider to try a pace.
        </p>
      )}

      {!finish.reached &&
        !isWhatIf &&
        finish.lowAt !== null &&
        finish.highAt !== null &&
        finish.levelsLeft > 0 && (
          <Figure
            title="Likely range"
            className={styles.inline}
            explain={
              <>
                <p>
                  The same projection at the 25th and 75th percentile of the counted levels. The
                  middle half of them took between {fmtDays(stats.p25Days!)} and{' '}
                  {fmtDays(stats.p75Days!)} days.
                </p>
                <Facts
                  rows={[
                    levelUpRow,
                    ['Levels after that', String(finish.levelsLeft)],
                    [
                      'At 25th percentile',
                      `${fmtDays(stats.p25Days!)} days, ${fmtDate(finish.lowAt)}`,
                    ],
                    [
                      'At 75th percentile',
                      `${fmtDays(stats.p75Days!)} days, ${fmtDate(finish.highAt)}`,
                    ],
                  ]}
                />
              </>
            }
          >
            Likely between {fmtShort(finish.lowAt)} and {fmtShort(finish.highAt)}, from the middle
            half of {owner} levels.
          </Figure>
        )}

      {isWhatIf && (
        <div className={styles.whatIf}>
          <p>
            What-if pace.{' '}
            {median === null
              ? 'No passed levels yet.'
              : `${owner[0]!.toUpperCase()}${owner.slice(1)} median is ${fmtDays(median)} days.`}
          </p>
          {median !== null && (
            <Button small onClick={() => setWhatIf(null)}>
              Use median
            </Button>
          )}
        </div>
      )}

      {!finish.reached && (
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <label htmlFor={paceId}>Days per level</label>
            <output htmlFor={paceId}>{pace === null ? '' : fmtDays(pace)}</output>
          </div>
          <input
            id={paceId}
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={0.1}
            value={sliderValue}
            aria-valuetext={pace === null ? 'Not set' : `${fmtDays(pace)} days a level`}
            onChange={(e) => setWhatIf(Number(e.target.value))}
          />
          <div className={styles.ticks} aria-hidden="true">
            <span>{SLIDER_MIN}</span>
            <span>{SLIDER_MAX}</span>
          </div>
        </div>
      )}

      <dl className={styles.rows}>
        {!finish.reached && finish.fastestAt !== null && (
          <div>
            <dt>Fastest the SRS allows</dt>
            <dd>
              <Figure
                title="Fastest the SRS allows"
                label={`Fastest the SRS allows, ${fmtDate(finish.fastestAt)}`}
                explain={
                  <>
                    <p>
                      The earliest next level-up, then the shortest time each level can take when
                      every review is answered right on time. It comes from each level&apos;s kanji
                      and the radicals they wait on.
                    </p>
                    <Facts
                      rows={[
                        levelUpRow,
                        ...Array.from({ length: finish.levelsLeft }, (_, i): [string, string] => {
                          const l = p.level + 1 + i;
                          return [`Level ${l}`, fmtSpan(p.minLevelTimes.get(l) ?? 0)];
                        }),
                      ]}
                    />
                  </>
                }
              >
                {fmtDate(finish.fastestAt)}
              </Figure>
            </dd>
          </div>
        )}
        <div>
          <dt>All Guru through</dt>
          <dd>
            <Figure
              title="All Guru through"
              label={`All Guru through ${p.guruThrough ? `level ${p.guruThrough}` : 'no level yet'}`}
              explain={
                <p>
                  {p.guruThrough
                    ? `Every radical, kanji and vocabulary item in levels 1 to ${p.guruThrough} is at Guru or above. `
                    : 'Level 1 still has items below Guru. '}
                  Hidden items are left out.
                </p>
              }
            >
              {p.guruThrough ? `Level ${p.guruThrough}` : 'None yet'}
            </Figure>
          </dd>
        </div>
        <div>
          <dt>All burned through</dt>
          <dd>
            <Figure
              title="All burned through"
              label={`All burned through ${p.burnedThrough ? `level ${p.burnedThrough}` : 'no level yet'}`}
              explain={
                <p>
                  {p.burnedThrough
                    ? `Every radical, kanji and vocabulary item in levels 1 to ${p.burnedThrough} is burned. `
                    : 'Level 1 still has items that are not burned. '}
                  Hidden items are left out.
                </p>
              }
            >
              {p.burnedThrough ? `Level ${p.burnedThrough}` : 'None yet'}
            </Figure>
          </dd>
        </div>
      </dl>

      {!finish.reached && finish.levelsLeft > 0 && (
        <div className={styles.goalDate}>
          <div className={styles.dateRow}>
            <label htmlFor={dateId}>Finish by</label>
            <span className={styles.dateControls}>
              <input
                id={dateId}
                type="date"
                className={styles.select}
                value={goalDate ?? ''}
                onChange={(e) => void setGoalDate(e.target.value || null)}
              />
              {goalDate && (
                <Button small onClick={() => void setGoalDate(null)}>
                  Clear
                </Button>
              )}
            </span>
          </div>
          {goalAt !== null &&
            (required === null ? (
              <p className={styles.note}>
                Pick a date after {fmtDate(lu)}, the earliest next level-up.
              </p>
            ) : (
              <Figure
                title="Pace for the date"
                className={styles.inline}
                explain={
                  <>
                    <p>
                      The time from the earliest next level-up to the date, spread over the levels
                      after it.
                    </p>
                    <Facts
                      rows={[
                        levelUpRow,
                        ['Finish by', fmtDate(goalAt)],
                        ['Time between', `${fmtDays((goalAt - lu) / DAY_MS)} days`],
                        ['Levels', `${finish.levelsLeft}, ${between}`],
                      ]}
                    />
                  </>
                }
              >
                To finish by {fmtDate(goalAt)}, you need about {fmtDays(required)} days a level.
              </Figure>
            ))}
        </div>
      )}
    </Card>
  );
}
