import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  useAssignments,
  useLevelProgressions,
  useResets,
  useSrsSystems,
  useSubjects,
  useUser,
} from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { useAppMode } from '../../db/useAppMode';
import { minLevelTimes } from '../../domain/fastest';
import { toggleLevel, toPaceOverrides } from '../../domain/levelOverrides';
import { levelDurations } from '../../domain/levels';
import { earliestLevelUp } from '../../domain/levelUp';
import { allBurnedThrough, allGuruThrough, paceStats } from '../../domain/pace';
import { useNow } from '../../hooks/useNow';
import { DAY_MS } from './format';
import { LevelChart } from './LevelChart';
import styles from './Pace.module.css';
import { Projection } from './Projection';

export function PaceScreen() {
  const user = useUser();
  const subjects = useSubjects();
  const assignments = useAssignments();
  const progressions = useLevelProgressions();
  const resets = useResets();
  const systems = useSrsSystems();
  const now = useNow();
  const owner = useAppMode() === 'live' ? 'your' : "the sample's";
  const [overrides, setOverrides] = usePref('levelOverrides');

  const data = useMemo(() => {
    if (!user || !subjects?.length || !assignments || !progressions || !resets || !systems)
      return null;
    return {
      timing: levelDurations({ user, progressions, resets, subjects, assignments, now }),
      levelUp: earliestLevelUp({ user, subjects, assignments, systems, now }),
      minTimes: minLevelTimes(subjects, systems),
      guru: allGuruThrough(subjects, assignments, systems),
      burned: allBurnedThrough(subjects, assignments, systems),
    };
  }, [user, subjects, assignments, progressions, resets, systems, now]);

  const stats = useMemo(
    () => data && paceStats(data.timing.levels, toPaceOverrides(overrides)),
    [data, overrides],
  );

  if (!user || !data || !stats) {
    return (
      <>
        <ScreenHeader title="Pace" />
        <Card title="Projected finish">
          <p className={styles.note}>
            The finish date and time per level appear after the first sync.
          </p>
        </Card>
      </>
    );
  }

  const current = data.timing.levels.find((l) => l.current);
  const day = current ? Math.floor(current.durationMs / DAY_MS) + 1 : null;

  return (
    <>
      <ScreenHeader
        title="Pace"
        aside={`Level ${user.level}${day === null ? '' : `, day ${day}`}`}
      />
      <div className={styles.grid}>
        <Projection
          level={user.level}
          maxLevelGranted={user.subscription.max_level_granted}
          earliestLevelUpAt={data.levelUp.earliestAt}
          onVacation={data.levelUp.status === 'vacation'}
          stats={stats}
          minLevelTimes={data.minTimes}
          guruThrough={data.guru}
          burnedThrough={data.burned}
          now={now}
          owner={owner}
        />
        <LevelChart
          stats={stats}
          resets={data.timing.resets}
          onToggle={(row) => void setOverrides(toggleLevel(overrides, row))}
        />
      </div>
    </>
  );
}
