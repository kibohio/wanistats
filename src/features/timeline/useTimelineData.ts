import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAssignments, useSrsSystems, useSubjects, useUser } from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { earliestLevelUp } from '../../domain/levelUp';
import {
  timeline,
  type Granularity,
  type Timeline,
  type TimelineRange,
} from '../../domain/timeline';
import { useNow } from '../../hooks/useNow';

/** A subject behind a bar, for the selection panel. */
export interface TimelineItem {
  char: string;
  stage: number;
  critical: boolean;
}

export interface TimelineData {
  timeline: Timeline;
  items: Map<number, TimelineItem>;
  lessonsPerDay: number;
}

const DESKTOP = '(min-width: 1024px)';
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches);
}

// Module map first so memory survives navigation even where sessionStorage throws; the
// sessionStorage copy keeps it across reloads in the same tab only.
const memory = new Map<string, unknown>();
const STORE = 'wanistats:timeline:';

function recall(key: string): unknown {
  if (memory.has(key)) return memory.get(key);
  try {
    return JSON.parse(sessionStorage.getItem(STORE + key) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Timeline view state (range, lessons toggle, selected bar) that outlives the component, so
 * leaving and coming back keeps the view. Callers validate what comes back.
 */
export function useRemembered<T>(key: string, fallback: T): [unknown, (v: T) => void] {
  const [value, setValue] = useState<unknown>(() => recall(key) ?? fallback);
  const remember = useCallback(
    (v: T) => {
      setValue(v);
      memory.set(key, v);
      try {
        sessionStorage.setItem(STORE + key, JSON.stringify(v));
      } catch {
        // Private mode or blocked storage: the module map still covers in-app navigation.
      }
    },
    [key],
  );
  return [value, remember];
}

/** Spec 9.7 bins: phones get fewer, wider bars. */
export function granularityFor(range: TimelineRange, desktop: boolean): Granularity {
  if (range === '24h') return 'hour';
  if (range === '7d') return desktop ? 'hour' : 'day';
  if (range === '30d') return 'day';
  return desktop ? 'day' : 'week';
}

/** The SRS system new lessons follow: the one the current level's subjects use. */
export function useLessonSystem() {
  const user = useUser();
  const subjects = useSubjects();
  const systems = useSrsSystems();
  return useMemo(() => {
    if (!systems?.length) return undefined;
    // ponytail: first current-level subject decides; WaniKani uses one system per level.
    const id = subjects?.find((s) => s.data.level === user?.level && !s.data.hidden_at)?.data
      .spaced_repetition_system_id;
    return (systems.find((s) => s.id === id) ?? systems[0]).data;
  }, [user?.level, subjects, systems]);
}

export function useTimelineData(
  range: TimelineRange,
  granularity: Granularity,
  withLessons: boolean,
): TimelineData | undefined {
  const user = useUser();
  const subjects = useSubjects();
  const assignments = useAssignments();
  const systems = useSrsSystems();
  const system = useLessonSystem();
  const [lessonsPerDay] = usePref('lessonsPerDay');
  const [lessonMin] = usePref('lessonMin');
  const [stackBy] = usePref('timelineSplit');
  const now = useNow();

  const critical = useMemo(() => {
    if (!user || !subjects || !assignments || !systems?.length) return new Set<number>();
    const p = earliestLevelUp({ user, subjects, assignments, systems, now });
    return new Set(p.kanji.filter((k) => k.critical).map((k) => k.subjectId));
  }, [user, subjects, assignments, systems, now]);

  const items = useMemo(() => {
    const stages = new Map(assignments?.map((a) => [a.data.subject_id, a.data.srs_stage]));
    const map = new Map<number, TimelineItem>();
    for (const s of subjects ?? []) {
      const stage = stages.get(s.id);
      if (stage === undefined) continue;
      map.set(s.id, {
        char: s.data.characters ?? s.data.slug,
        stage,
        critical: critical.has(s.id),
      });
    }
    return map;
  }, [subjects, assignments, critical]);

  const data = useMemo(() => {
    if (!assignments) return undefined;
    return timeline(assignments, now, {
      range,
      granularity,
      stackBy,
      criticalIds: critical,
      lessons: withLessons && system ? { perDay: lessonsPerDay, lessonMin, system } : undefined,
    });
  }, [
    assignments,
    now,
    range,
    granularity,
    stackBy,
    critical,
    withLessons,
    system,
    lessonsPerDay,
    lessonMin,
  ]);

  return data && { timeline: data, items, lessonsPerDay };
}
