import { useMemo } from 'react';
import {
  useAssignments,
  useLevelProgressions,
  useResets,
  useReviewStatistics,
  useSnapshotDeltas,
  useSnapshots,
  useSrsSystems,
  useSubjects,
  useUser,
} from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { useAppMode } from '../../db/useAppMode';
import { accuracy } from '../../domain/accuracy';
import { minLevelTimes } from '../../domain/fastest';
import { leeches } from '../../domain/leeches';
import { lessonWindow } from '../../domain/lessonWindow';
import { earliestLevelUp } from '../../domain/levelUp';
import { levelDurations } from '../../domain/levels';
import { allBurnedThrough, allGuruThrough, paceStats, projectFinish } from '../../domain/pace';
import { timeline } from '../../domain/timeline';
import {
  gapNotice,
  levelUpGroups,
  orderedKanji,
  overridesFromPrefs,
  peakBin,
  radicalProgress,
  reviewsAvailableNow,
} from '../../domain/today';
import { loadTrend, steadyStateReviewsPerDay, workload } from '../../domain/workload';
import { useNow } from '../../hooks/useNow';

/** Everything Today shows, computed once per data change or minute. Null while loading. */
export function useToday() {
  const sample = useAppMode() === 'sample';
  const now = useNow();
  const user = useUser();
  const subjects = useSubjects();
  const assignments = useAssignments();
  const systems = useSrsSystems();
  const progressions = useLevelProgressions();
  const resets = useResets();
  const stats = useReviewStatistics();
  const snapshots = useSnapshots();
  const deltas = useSnapshotDeltas();
  const [goalLevel] = usePref('goalLevel');
  const [band] = usePref('band');
  const [lessonsPerDay] = usePref('lessonsPerDay');
  const [wakeHour] = usePref('wakeHour');
  const [sleepHour] = usePref('sleepHour');
  const [lessonHour] = usePref('lessonHour');
  const [levelOverrides] = usePref('levelOverrides');

  return useMemo(() => {
    if (
      !user ||
      !subjects?.length ||
      !assignments ||
      !systems?.length ||
      !progressions ||
      !resets ||
      !stats ||
      !snapshots ||
      !deltas
    )
      return null;
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const levelUp = earliestLevelUp({ user, subjects, assignments, systems, now });
    const criticalIds = new Set(levelUp.kanji.filter((k) => k.critical).map((k) => k.subjectId));
    const day24 = timeline(assignments, now, {
      range: '24h',
      granularity: 'hour',
      stackBy: 'stage',
      criticalIds,
    });
    const acc = accuracy(stats, snapshots, deltas, now);
    const itemAccuracy = (acc.recent30 ?? acc.lifetime).itemEstimate;
    // The system most current-level subjects use; WaniKani's two differ only below level 3.
    const levelSubject = subjects.find((s) => s.data.level === user.level);
    const system =
      systems.find((s) => s.id === levelSubject?.data.spaced_repetition_system_id) ?? systems[0];
    const { levels, resets: resetMarkers } = levelDurations({
      user,
      progressions,
      resets,
      subjects,
      assignments,
      now,
    });
    const current = levels.find((l) => l.current);
    const pace = paceStats(levels, overridesFromPrefs(levelOverrides));
    const finish =
      pace.medianDays === null
        ? null
        : projectFinish({
            goal: goalLevel,
            currentLevel: user.level,
            maxLevelGranted: user.subscription.max_level_granted,
            earliestLevelUpAt: levelUp.earliestAt,
            paceDays: pace.medianDays,
            p25Days: pace.p25Days,
            p75Days: pace.p75Days,
            minLevelTimes: minLevelTimes(subjects, systems),
          });
    return {
      sample,
      now,
      user,
      subjectById,
      levelUp,
      groups: levelUpGroups(levelUp, subjects, systems, now),
      ordered: orderedKanji(levelUp),
      radicals: radicalProgress(subjects, assignments, user.level),
      passingStage: system.data.passing_stage_position,
      work: workload(assignments, band),
      day24,
      peak: peakBin(day24.bins),
      trend: loadTrend(snapshots, now),
      accuracy: acc,
      itemAccuracy,
      lessonsPerDay,
      wakeHour,
      sleepHour,
      steady: itemAccuracy === null ? null : steadyStateReviewsPerDay(lessonsPerDay, itemAccuracy),
      lessonWindow: lessonWindow(system.data, { wakeHour, sleepHour, lessonHour }),
      levelStartAt: current?.startAt ?? null,
      levelDay: current ? Math.floor(current.durationMs / 86_400_000) + 1 : null,
      pace,
      hasReset: resetMarkers.length > 0,
      finish,
      guruThrough: allGuruThrough(subjects, assignments, systems),
      burnedThrough: allBurnedThrough(subjects, assignments, systems),
      availableNow: reviewsAvailableNow(assignments, now),
      leeches: leeches({ subjects, assignments, stats, snapshots, deltas, now }),
      gapSince: gapNotice(snapshots, now),
      vacation: user.current_vacation_started_at !== null,
      maxLevel: user.subscription.max_level_granted,
      assignments,
      subjects,
    };
  }, [
    sample,
    now,
    user,
    subjects,
    assignments,
    systems,
    progressions,
    resets,
    stats,
    snapshots,
    deltas,
    goalLevel,
    band,
    lessonsPerDay,
    wakeHour,
    sleepHour,
    lessonHour,
    levelOverrides,
  ]);
}

export type TodayData = NonNullable<ReturnType<typeof useToday>>;
