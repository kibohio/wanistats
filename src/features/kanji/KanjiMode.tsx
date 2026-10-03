import { useMemo, useRef, useState } from 'react';
import type { KanjiResource, SubjectType } from '../../api/types';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Chip } from '../../components/Chip';
import { ItemSheet } from '../../components/ItemSheet';
import { useAssignments, useSnapshots, useSubjects } from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { useAppMode } from '../../db/useAppMode';
import {
  coverageGrowth,
  decodeRanks,
  kanjiGroups,
  weightedKanjiCoverage,
  type KanjiCell,
  type KanjiView,
} from '../../domain/coverage';
import { useNow } from '../../hooks/useNow';
import { usePack } from '../../packs/hooks';
import { SAMPLE_COVERAGE_LABEL, sampleKanji } from '../../packs/sampleCoverage';
import { PackEmptyState, PackUpdateLine } from '../packs/PackPrompts';
import styles from './Kanji.module.css';
import { KanjiGrid, type GridHandle } from './KanjiGrid';
import { CoverageBars, Estimated, Explained, num, pctText } from './parts';
import { gradeLabel, knownRange, stageName } from './stage';
import { plural } from '../../format';

const LISTS = [
  { value: 'jlpt', label: 'JLPT' },
  { value: 'joyo', label: 'Jōyō' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'level', label: 'WK level' },
] as const;

const CAPTION: Record<KanjiView, string> = {
  jlpt: 'JLPT (unofficial lists), N5 to N1',
  joyo: 'Jōyō kanji by school grade',
  frequency: 'Jiten frequency rank, most common first',
  level: 'WaniKani levels',
};

const LEGEND = [
  { stage: '0', label: 'Not started' },
  { stage: '1', label: 'Apprentice' },
  { stage: '5', label: 'Guru' },
  { stage: '7', label: 'Master' },
  { stage: '8', label: 'Enlightened' },
  { stage: '9', label: 'Burned' },
  { stage: 'none', label: 'Not in WaniKani' },
];

export function KanjiMode() {
  const sampleMode = useAppMode() === 'sample';
  const subjects = useSubjects();
  const assignments = useAssignments();
  const snapshots = useSnapshots();
  const now = useNow();
  const installed = usePack('kanji');
  const isSample = installed === null && sampleMode;
  const pack = isSample ? sampleKanji : (installed ?? undefined);

  const [knownStage] = usePref('knownStage');
  const [view, setView] = useState<KanjiView>('jlpt');
  const [selected, setSelected] = useState<KanjiCell | null>(null);
  const gridRef = useRef<GridHandle>(null);

  const groups = useMemo(
    () =>
      subjects && assignments
        ? kanjiGroups(view, subjects, assignments, pack, knownStage).filter((g) => g.total > 0)
        : [],
    [view, subjects, assignments, pack, knownStage],
  );
  const weighted = useMemo(
    () =>
      subjects && assignments && pack
        ? weightedKanjiCoverage(subjects, assignments, pack, knownStage)
        : null,
    [subjects, assignments, pack, knownStage],
  );
  const growth = useMemo(
    () => (snapshots ? coverageGrowth(snapshots, now) : null),
    [snapshots, now],
  );

  // Lookups for cell labels and the item sheet's list facts.
  const subjectById = useMemo(
    () =>
      new Map(subjects?.filter((s) => s.object === 'kanji').map((s) => [s.id, s as KanjiResource])),
    [subjects],
  );
  const packIndex = useMemo(() => new Map(pack?.chars.map((c, i) => [c, i])), [pack]);
  const ranks = useMemo(() => (pack ? decodeRanks(pack.rank) : []), [pack]);

  const listFacts = (char: string, type: SubjectType): [string, string][] => {
    const i = type === 'kanji' ? packIndex.get(char) : undefined;
    if (!pack || i === undefined) return [];
    const facts: [string, string | undefined][] = [
      ['Rank', ranks[i] ? num(ranks[i]) : undefined],
      ['JLPT', pack.jlpt[i] ? `N${pack.jlpt[i]}` : undefined],
      ['Grade', gradeLabel(pack.grade[i]!)],
    ];
    return facts.filter((f): f is [string, string] => !!f[1]);
  };

  const packLoading = view !== 'level' && installed === undefined;
  const needsPack = view !== 'level' && !pack && !packLoading;
  const ariaFor = (c: KanjiCell) => {
    const meaning = c.subjectId && primaryMeaning(subjectById.get(c.subjectId));
    return [c.char, meaning, c.inWaniKani ? stageName(c.stage) : 'not in WaniKani']
      .filter(Boolean)
      .join(', ');
  };

  return (
    <>
      <SegmentedControl
        label="Kanji list"
        options={LISTS}
        value={view}
        onChange={(v) => {
          setView(v);
          setSelected(null);
        }}
      />
      <p className={styles.caption}>
        {CAPTION[view]}
        {isSample && view !== 'level' && <Chip>{SAMPLE_COVERAGE_LABEL}</Chip>}
      </p>

      {installed && <PackUpdateLine packId="kanji" />}

      {packLoading ? null : needsPack ? (
        <PackEmptyState packId="kanji">
          The {view === 'jlpt' ? 'JLPT' : view === 'joyo' ? 'Jōyō' : 'Frequency'} view needs the
          kanji lists. The WK level view works without a download.
        </PackEmptyState>
      ) : (
        <>
          {view !== 'level' && (
            <CoverageBars
              label="Coverage by group"
              bars={groups}
              onPick={(key) => gridRef.current?.scrollToGroup(key)}
            />
          )}
          {weighted && (
            <Explained
              how={
                <p>
                  Common kanji count for more. Jiten only publishes frequency ranks, so each kanji
                  is weighted 1 ÷ rank (Zipf&apos;s law), which makes this an estimate. Known means{' '}
                  {knownRange(knownStage)}
                  {knownStage === 5 ? ' at least once' : ' now'}.
                </p>
              }
            >
              {isSample ? 'This sample knows' : 'You know'} the kanji behind{' '}
              <strong>{pctText(weighted.pct)}</strong> of kanji appearances in Jiten&apos;s corpus.{' '}
              <Estimated />
            </Explained>
          )}
          {growth && growth.days > 0 && (
            <Explained
              how={
                <p>
                  The change between the latest snapshot and the one from{' '}
                  {plural(growth.days, 'day')} before.
                </p>
              }
            >
              {growth.kanji >= 0 ? '+' : ''}
              {num(growth.kanji)} kanji known{knownStage > 5 && ' at Guru'} in the last{' '}
              {growth.days === 1 ? 'day' : `${growth.days} days`}.
            </Explained>
          )}
          <ul className={styles.legend} aria-label="Legend">
            {LEGEND.map((l) => (
              <li key={l.stage}>
                <span className={styles.swatch} data-stage={l.stage} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
          {subjects && groups.length === 0 && (
            <p className={styles.caption}>No kanji yet. They appear after the first sync.</p>
          )}
          <KanjiGrid
            ref={gridRef}
            groups={groups}
            selected={selected}
            onSelect={setSelected}
            ariaFor={ariaFor}
          />
        </>
      )}

      <ItemSheet
        subject={selected && (selected.subjectId ?? selected.char)}
        onClose={() => setSelected(null)}
        extraFacts={listFacts}
      />
    </>
  );
}

function primaryMeaning(s: KanjiResource | undefined) {
  const m = s?.data.meanings.find((x) => x.primary)?.meaning;
  return m && m.charAt(0).toUpperCase() + m.slice(1);
}
