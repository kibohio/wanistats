import { useMemo } from 'react';
import {
  useAssignments,
  useLevelProgressions,
  useResets,
  useSrsSystems,
  useSubjects,
  useUser,
} from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { minLevelTimes } from '../../domain/fastest';
import { earliestLevelUp } from '../../domain/levelUp';
import { levelDurations } from '../../domain/levels';
import { paceStats, projectFinish, type LevelOverride } from '../../domain/pace';
import { workload } from '../../domain/workload';
import { formatLocalDate } from '../../format';
import { localDateKey } from '../../domain/localDate';

export interface GlanceRow {
  label: string;
  value: string;
  note: string;
}

const when = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const BAND_WORD = { under: 'Below', in: 'Inside', over: 'Above' } as const;

/** Onboarding step 1: next level-up, workload and finish, from the synced data. */
export function useGlance(now: number): GlanceRow[] | undefined {
  const user = useUser();
  const subjects = useSubjects();
  const assignments = useAssignments();
  const systems = useSrsSystems();
  const progressions = useLevelProgressions();
  const resets = useResets();
  const [goal] = usePref('goalLevel');
  const [band] = usePref('band');
  const [overrides] = usePref('levelOverrides');

  return useMemo(() => {
    if (!user || !subjects?.length || !assignments || !systems || !progressions || !resets) {
      return undefined;
    }
    const up = earliestLevelUp({ user, subjects, assignments, systems, now });
    const load = workload(assignments, band);
    const { levels } = levelDurations({ user, progressions, resets, subjects, assignments, now });
    const pace = paceStats(
      levels,
      Object.fromEntries(
        Object.entries(overrides).map(([l, inc]): [string, LevelOverride] => [
          l,
          inc ? 'include' : 'exclude',
        ]),
      ),
    );
    const finish =
      pace.medianDays === null
        ? null
        : projectFinish({
            goal,
            currentLevel: user.level,
            maxLevelGranted: user.subscription.max_level_granted,
            earliestLevelUpAt: up.earliestAt,
            paceDays: pace.medianDays,
            p25Days: pace.p25Days,
            p75Days: pace.p75Days,
            minLevelTimes: minLevelTimes(subjects, systems),
          });

    const levelUp: GlanceRow = {
      label: 'Next level-up',
      value:
        up.status === 'ready'
          ? 'Ready now'
          : up.status === 'capped'
            ? `Subscription limit, level ${user.subscription.max_level_granted}`
            : when.format(up.earliestAt),
      note: `${up.passed} of ${up.total} kanji at Guru${up.status === 'vacation' ? '. Vacation mode is on' : ''}`,
    };
    const work: GlanceRow = {
      label: 'Workload',
      value: `Load ${Math.round(load.load)}`,
      note: `${BAND_WORD[load.status]} the ${band.min} to ${band.max} band`,
    };
    const end: GlanceRow = {
      label: `Level ${finish?.goal ?? goal}`,
      value: !finish
        ? 'After the first level-up'
        : finish.reached
          ? 'Reached'
          : formatLocalDate(localDateKey(finish.finishAt!)),
      note: !finish
        ? 'The finish date uses the median time per level.'
        : `At ${pace.medianDays!.toFixed(1)} days a level${finish.capped ? ', the subscription limit' : ''}`,
    };
    return [levelUp, work, end];
  }, [user, subjects, assignments, systems, progressions, resets, goal, band, overrides, now]);
}
