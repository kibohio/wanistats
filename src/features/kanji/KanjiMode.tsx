import { useEffect, useMemo, useRef, useState } from 'react';
import type { KanjiResource } from '../../api/types';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Chip } from '../../components/Chip';
import { ExternalIcon, CloseIcon } from '../../components/icons';
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

  // Lookups for the peek sheet and cell labels.
  const subjectById = useMemo(
    () =>
      new Map(subjects?.filter((s) => s.object === 'kanji').map((s) => [s.id, s as KanjiResource])),
    [subjects],
  );
  const packIndex = useMemo(() => new Map(pack?.chars.map((c, i) => [c, i])), [pack]);
  const ranks = useMemo(() => (pack ? decodeRanks(pack.rank) : []), [pack]);

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
                  Jiten publishes frequency ranks, not counts, so each kanji is weighted by 1 / rank
                  (a Zipf fit). The figure is the weight of known kanji over the weight of every
                  ranked kanji. Known means {knownRange(knownStage)}
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
                  Kanji passed in the latest daily snapshot minus the snapshot from {growth.days}{' '}
                  days before it.
                </p>
              }
            >
              {growth.kanji >= 0 ? '+' : ''}
              {num(growth.kanji)} kanji known{knownStage > 5 && ' at Guru'} in the last{' '}
              {growth.days} days.
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

      {selected && (
        <Peek
          cell={selected}
          subject={selected.subjectId ? subjectById.get(selected.subjectId) : undefined}
          packAt={packIndex.get(selected.char)}
          pack={pack}
          rank={ranks[packIndex.get(selected.char) ?? -1] ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function primaryMeaning(s: KanjiResource | undefined) {
  const m = s?.data.meanings.find((x) => x.primary)?.meaning;
  return m && m.charAt(0).toUpperCase() + m.slice(1);
}

function Peek({
  cell,
  subject,
  pack,
  packAt,
  rank,
  onClose,
}: {
  cell: KanjiCell;
  subject: KanjiResource | undefined;
  pack: typeof sampleKanji | undefined;
  packAt: number | undefined;
  rank: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const readings = (type: 'onyomi' | 'kunyomi') =>
    subject?.data.readings
      .filter((r) => r.type === type && r.accepted_answer)
      .map((r) => r.reading)
      .join(', ');
  const jlpt = pack && packAt !== undefined ? pack.jlpt[packAt] : 0;
  const grade = pack && packAt !== undefined ? pack.grade[packAt] : 0;
  const facts: [string, string | undefined][] = [
    ['On', readings('onyomi')],
    ['Kun', readings('kunyomi')],
    ['Stage', cell.inWaniKani ? stageName(cell.stage) : 'Not in WaniKani'],
    ['Level', cell.level ? String(cell.level) : undefined],
    ['Rank', rank ? num(rank) : undefined],
    ['JLPT', jlpt ? `N${jlpt}` : undefined],
    ['Grade', gradeLabel(grade)],
  ];
  return (
    <section className={styles.peek} aria-label="Selected kanji" aria-live="polite">
      <div className={styles.peekTop}>
        <span className={styles.peekTile} data-stage={cell.inWaniKani ? cell.stage : 'none'}>
          {cell.char}
        </span>
        <div className={styles.peekText}>
          <span className={styles.peekMeaning}>{primaryMeaning(subject) ?? cell.char}</span>
          <dl className={styles.facts}>
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
        <button type="button" className={styles.peekClose} aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {cell.inWaniKani && (
        <a
          className={styles.wkLink}
          href={`https://www.wanikani.com/kanji/${encodeURIComponent(cell.char)}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in WaniKani
          <ExternalIcon size={14} />
        </a>
      )}
    </section>
  );
}
