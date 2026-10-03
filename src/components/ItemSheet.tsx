import { useEffect, useMemo, useRef, useState } from 'react';
import type { SubjectType } from '../api/types';
import {
  useAssignments,
  useReviewStatistics,
  useSnapshotDeltas,
  useSnapshots,
  useSubjects,
} from '../db/hooks';
import { buildItems, stageName, type Item } from '../domain/items';
import { leeches } from '../domain/leeches';
import { formatSyncTime } from '../format';
import { useNow } from '../hooks/useNow';
import { ExternalIcon } from './icons';
import styles from './ItemSheet.module.css';
import { Sheet } from './Sheet';
import { Tile } from './Tile';

const TYPE_NAME = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Kana vocabulary',
} as const;
const READING_TYPE = { onyomi: "On'yomi", kunyomi: "Kun'yomi", nanori: 'Nanori' } as const;
const USED_IN_SHOWN = 8;

/** A subject id, or the characters of a kanji WaniKani does not teach. */
export type SheetSubject = number | string;

interface Props {
  /** What to show; null keeps the sheet closed. */
  subject: SheetSubject | null;
  onClose: () => void;
  /** Items by id when the screen has built them already; without it the sheet loads its own. */
  byId?: Map<number, Item>;
  /** Screen-specific facts, e.g. frequency rank and JLPT level on the Kanji screen. */
  extraFacts?: (characters: string, type: SubjectType) => [string, string][];
}

/** Item details: facts, related subjects (tappable, with Back), look-alikes and a WaniKani link. */
export function ItemSheet({ subject, byId, ...rest }: Props) {
  if (subject === null) return null;
  return byId ? (
    <OpenSheet key={subject} subject={subject} byId={byId} {...rest} />
  ) : (
    <LoadingSheet key={subject} subject={subject} {...rest} />
  );
}

function LoadingSheet(props: Omit<Props, 'byId'> & { subject: SheetSubject }) {
  const byId = useItemIndex();
  return byId ? <OpenSheet {...props} byId={byId} /> : null;
}

/** Every item with its assignment, statistics and leech entry, by subject id. */
export function useItemIndex(): Map<number, Item> | undefined {
  const subjects = useSubjects();
  const assignments = useAssignments();
  const stats = useReviewStatistics();
  const snapshots = useSnapshots();
  const deltas = useSnapshotDeltas();
  const now = useNow();
  return useMemo(() => {
    if (!subjects || !assignments || !stats || !snapshots || !deltas) return undefined;
    const report = leeches({ subjects, assignments, stats, snapshots, deltas, now });
    const items = buildItems({ subjects, assignments, stats, leeches: report.leeches, now });
    return new Map(items.map((i) => [i.id, i]));
  }, [subjects, assignments, stats, snapshots, deltas, now]);
}

function OpenSheet({
  subject,
  byId,
  onClose,
  extraFacts,
}: Omit<Props, 'subject' | 'byId'> & { subject: SheetSubject; byId: Map<number, Item> }) {
  const now = useNow();
  const [trail, setTrail] = useState<SheetSubject[]>([subject]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // After moving within the sheet the tapped button is gone, so focus the new content from the top.
  useEffect(() => {
    const body = bodyRef.current;
    if (!moved.current || !body) return;
    body.focus({ preventScroll: true });
    const dialog = body.closest('dialog');
    if (dialog) dialog.scrollTop = 0;
  }, [trail]);

  const label = (s: SheetSubject) => (typeof s === 'string' ? s : (byId.get(s)?.meaning ?? ''));
  const current = trail[trail.length - 1]!;
  const item = typeof current === 'number' ? byId.get(current) : undefined;
  if (typeof current === 'number' && !item) return null;
  const go = (next: SheetSubject[]) => {
    moved.current = true;
    setTrail(next);
  };

  const type: SubjectType = item?.type ?? 'kanji';
  const chars = item ? item.characters : (current as string);
  const extra = chars && extraFacts ? extraFacts(chars, type) : [];
  const facts: [string, string][] = item
    ? itemFacts(item, now, extra)
    : [['Type', TYPE_NAME.kanji], ['Stage', 'Not in WaniKani'], ...extra];
  const lists = item ? relatedLists(item, byId) : [];

  return (
    <Sheet open onClose={onClose} title={label(current) || (chars ?? '')}>
      <div ref={bodyRef} tabIndex={-1} className={styles.body}>
        {trail.length > 1 && (
          <button type="button" className={styles.back} onClick={() => go(trail.slice(0, -1))}>
            Back to {label(trail[trail.length - 2]!)}
          </button>
        )}
        {item ? (
          <ItemGlyph item={item} size="large" />
        ) : (
          <Tile char={chars!} mark="outside" className={`${styles.glyph} ${styles.large}`} />
        )}
        <dl className={styles.facts}>
          {facts.map(([k, v]) => (
            <div key={k} className={styles.fact}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {lists.map((l) => (
          <section key={l.title} className={styles.related} aria-label={l.title}>
            <h3 className={styles.relatedHead}>{l.title}</h3>
            <ul>
              {l.items.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className={styles.relatedButton}
                    onClick={() => go([...trail, x.id])}
                  >
                    <ItemGlyph item={x} />
                    <span>
                      {x.meaning}
                      {x.reading && `, ${x.reading}`}, {stageName(x.stage)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {item?.documentUrl && (
          <a href={item.documentUrl} target="_blank" rel="noreferrer" className={styles.external}>
            Open in WaniKani <ExternalIcon />
          </a>
        )}
      </div>
    </Sheet>
  );
}

function itemFacts(item: Item, now: number, extra: [string, string][]): [string, string][] {
  const a = item.answers;
  const readings = item.readings.some((r) => r.type)
    ? (['onyomi', 'kunyomi', 'nanori'] as const)
        .map((t) => ({
          label: READING_TYPE[t],
          list: item.readings.filter((r) => r.type === t).map((r) => r.reading),
        }))
        .filter((g) => g.list.length)
    : item.readings.length
      ? [{ label: 'Readings', list: item.readings.map((r) => r.reading) }]
      : [];
  return [
    ['Type', TYPE_NAME[item.type]],
    ['Meanings', item.meanings.join(', ')],
    ...readings.map((g): [string, string] => [g.label, g.list.join(', ')]),
    ['Stage', stageName(item.stage)],
    ['Level', String(item.level)],
    ...extra,
    ['Next review', nextReviewText(item, now)],
    [
      'Accuracy',
      item.accuracy === null || !a
        ? 'No answers yet'
        : `${Math.round(item.accuracy * 100)}%: meaning ${a.meaningCorrect} of ${a.meaningTotal}` +
          (a.readingTotal ? `, reading ${a.readingCorrect} of ${a.readingTotal}` : ''),
    ],
    ...(item.leech
      ? [
          [
            'Leech score',
            `${item.leech.score.toFixed(1)}, from ${item.incorrect} wrong answers`,
          ] as [string, string],
        ]
      : []),
  ];
}

function relatedLists(item: Item, byId: Map<number, Item>) {
  const pick = (ids: number[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const related = pick(item.relatedIds);
  const lists: { title: string; items: Item[] }[] = [];
  if (item.type === 'radical' && related.length) {
    const more = related.length > USED_IN_SHOWN ? `, first ${USED_IN_SHOWN} shown` : '';
    lists.push({
      title: `Used in ${related.length} kanji${more}`,
      items: related.slice(0, USED_IN_SHOWN),
    });
  } else if (related.length) {
    lists.push({ title: item.type === 'kanji' ? 'Radicals' : 'Kanji', items: related });
  }
  const alikes = pick(item.lookAlikeIds);
  if (alikes.length) lists.push({ title: 'Look-alikes', items: alikes });
  return lists;
}

export function ItemGlyph({ item, size }: { item: Item; size?: 'large' }) {
  const len = item.characters?.length ?? 1;
  const cls = [styles.glyph, size === 'large' ? styles.large : styles[`len${Math.min(len, 3)}`]];
  if (item.characters === null && item.imageUrl)
    return (
      <span className={`${styles.imageTile} ${cls.join(' ')}`}>
        <img src={item.imageUrl} alt="" />
      </span>
    );
  return (
    <Tile
      char={item.characters ?? item.meaning}
      srsStage={item.stage ?? undefined}
      className={cls.join(' ')}
    />
  );
}

export function nextReviewText(item: Item, now: number): string {
  if (item.availableAt === null) return item.stage === 9 ? 'Burned' : 'Not started';
  return item.availableAt <= now ? 'Available now' : formatSyncTime(item.availableAt, now);
}
