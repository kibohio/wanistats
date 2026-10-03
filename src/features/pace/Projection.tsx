import { useId, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Stepper } from '../../components/Stepper';
import { usePref } from '../../db/prefs';
import { projectFinish, requiredDaysPerLevel, type PaceStats } from '../../domain/pace';
import { Facts, Figure } from './Figure';
import { formatDate, formatDateRange } from '../../format';
import { useClock } from '../../hooks/useClock';
import { DAY_MS, fmtDateTime, fmtDays, fmtSpan, plural } from './format';
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
  /** 'your' when logged in, "the sample's" otherwise. */
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
  const clock = useClock();

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
  const levelUpRow: [string, string] = ['Next level-up (earliest)', fmtDateTime(lu, clock)];

  const goalSelect = (
    <span className={styles.goal}>
      <label htmlFor={goalId}>Goal level</label>
      <Stepper
        id={goalId}
        label="Goal level"
        value={goal}
        min={minGoal}
        max={MAX_LEVEL}
        onChange={(v) => void setGoal(v)}
      />
    </span>
  );

  return (
    <Card title="Projected finish" aside={goalSelect}>
      {finish.capped && (
        <p className={styles.note}>
          This subscription stops at level {p.maxLevelGranted}, so the projection does too.
        </p>
      )}
      {p.onVacation && (
        <p className={styles.note}>Vacation mode is on. These dates assume it ends today.</p>
      )}

      {finish.reached ? (
        <p className={styles.lead}>Level {finish.goal} reached.</p>
      ) : finish.finishAt !== null && pace !== null ? (
        <Figure
          title="Projected finish"
          className={styles.finishBlock}
          explain={
            <>
              <p>
                Your earliest next level-up, then {plural(finish.levelsLeft, 'more level')} at the
                pace below.
              </p>
              <Facts
                rows={[
                  levelUpRow,
                  ['Levels after that', String(finish.levelsLeft)],
                  [
                    'Pace',
                    isWhatIf
                      ? `${fmtDays(pace)} days per level, what-if`
                      : `${fmtDays(pace)} days per level, median of ${plural(counted, 'level')}`,
                  ],
                  [
                    'Finish',
                    `${fmtDateTime(lu, clock)} + ${finish.levelsLeft} × ${fmtDays(pace)} days`,
                  ],
                ]}
              />
            </>
          }
        >
          <span className={styles.finish}>{formatDate(finish.finishAt)}</span>
          <span className={styles.sub}>
            {plural(Math.max(0, Math.round((finish.finishAt - p.now) / DAY_MS)), 'day')} away
          </span>
        </Figure>
      ) : (
        <p className={styles.note}>
          Pass one level to get a projection. Until then, drag the slider to try a pace.
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
                  Half of {owner} levels took between {fmtDays(stats.p25Days!)} and{' '}
                  {fmtDays(stats.p75Days!)} days. The range is the finish date at each of those
                  paces.
                </p>
                <Facts
                  rows={[
                    levelUpRow,
                    ['Levels after that', String(finish.levelsLeft)],
                    ['Faster pace', `${fmtDays(stats.p25Days!)} days, ${formatDate(finish.lowAt)}`],
                    [
                      'Slower pace',
                      `${fmtDays(stats.p75Days!)} days, ${formatDate(finish.highAt)}`,
                    ],
                  ]}
                />
              </>
            }
          >
            Likely between {formatDateRange(finish.lowAt, finish.highAt).join(' and ')}.
          </Figure>
        )}

      {isWhatIf && (
        <div className={styles.whatIf}>
          <p>
            What-if pace.{' '}
            {median === null
              ? 'No passed levels yet.'
              : `${owner[0]!.toUpperCase()}${owner.slice(1)} median is ${fmtDays(median)} days per level.`}
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
            aria-valuetext={pace === null ? 'Not set' : `${fmtDays(pace)} days per level`}
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
            <dt>Fastest possible</dt>
            <dd>
              <Figure
                title="Fastest possible"
                label={`Fastest possible, ${formatDate(finish.fastestAt)}`}
                explain={
                  <>
                    <p>
                      This assumes every review is right and done the moment it comes up, from your
                      earliest next level-up on. Shortest time per level:
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
                {formatDate(finish.fastestAt)}
              </Figure>
            </dd>
          </div>
        )}
        <div>
          <dt>All Guru up to</dt>
          <dd>
            <Figure
              title="All Guru up to"
              label={`All Guru up to ${p.guruThrough ? `level ${p.guruThrough}` : 'no level yet'}`}
              explain={
                <p>
                  {p.guruThrough
                    ? `Everything in levels 1 to ${p.guruThrough} is at Guru or higher. `
                    : 'Level 1 still has items below Guru. '}
                  Items WaniKani has removed don&apos;t count.
                </p>
              }
            >
              {p.guruThrough ? `Level ${p.guruThrough}` : 'None yet'}
            </Figure>
          </dd>
        </div>
        <div>
          <dt>All burned up to</dt>
          <dd>
            <Figure
              title="All burned up to"
              label={`All burned up to ${p.burnedThrough ? `level ${p.burnedThrough}` : 'no level yet'}`}
              explain={
                <p>
                  {p.burnedThrough
                    ? `Everything in levels 1 to ${p.burnedThrough} is burned. `
                    : 'Level 1 still has unburned items. '}
                  Items WaniKani has removed don&apos;t count.
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
                Pick a date after {formatDate(lu)}, the earliest you can level up.
              </p>
            ) : (
              <Figure
                title="Pace for the date"
                className={styles.inline}
                explain={
                  <>
                    <p>
                      The days between your earliest next level-up and that date, split across the
                      levels after it.
                    </p>
                    <Facts
                      rows={[
                        levelUpRow,
                        ['Finish by', formatDate(goalAt)],
                        ['Time between', `${fmtDays((goalAt - lu) / DAY_MS)} days`],
                        ['Levels', `${finish.levelsLeft}, ${between}`],
                      ]}
                    />
                  </>
                }
              >
                To finish by {formatDate(goalAt)}, you need about {fmtDays(required)} days per
                level.
              </Figure>
            ))}
        </div>
      )}
    </Card>
  );
}
