import {
  columnGroupingFeature,
  createColumnHelper,
  createGroupedRowModel,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useClock } from '../../hooks/useClock';
import { ItemGlyph, nextReviewText } from '../../components/ItemSheet';
import { stageGroup, stageName, type Item } from '../../domain/items';
import styles from './Items.module.css';

export type GroupBy = 'none' | 'level' | 'type' | 'stage' | 'section';
export type SortBy = 'leechScore' | 'level' | 'accuracy' | 'next';

const features = tableFeatures({
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const TYPE_LABEL = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Kana vocabulary',
} as const;
const STAGE_GROUPS = ['Apprentice', 'Guru', 'Master', 'Enlightened', 'Burned', 'Lesson', 'Locked'];
const TYPES = Object.keys(TYPE_LABEL);

// Group columns return sortable keys; groupLabel turns them back into words.
const helper = createColumnHelper<typeof features, Item>();
const columns = helper.columns([
  helper.accessor('level', { id: 'level' }),
  helper.accessor((i) => TYPES.indexOf(i.type), { id: 'type' }),
  helper.accessor((i) => STAGE_GROUPS.indexOf(stageGroup(i.stage)), { id: 'stage' }),
  helper.accessor((i) => (i.leech?.recentlyStruggling ? 0 : 1), { id: 'section' }),
  helper.accessor('leechScore', { id: 'leechScore' }),
  helper.accessor((i) => i.accuracy ?? undefined, { id: 'accuracy', sortUndefined: 'last' }),
  helper.accessor((i) => i.availableAt ?? undefined, { id: 'next', sortUndefined: 'last' }),
]);

function groupLabel(by: GroupBy, key: number): string {
  if (by === 'level') return `Level ${key}`;
  if (by === 'type') return TYPE_LABEL[TYPES[key] as Item['type']];
  if (by === 'stage') return STAGE_GROUPS[key]!;
  return key === 0 ? 'Recently struggling' : 'Other leeches';
}

const getRowId = (i: Item) => String(i.id);

type Line = { kind: 'group'; label: string; count: number } | { kind: 'item'; item: Item };

interface Props {
  items: Item[];
  byId: Map<number, Item>;
  groupBy: GroupBy;
  sortBy: SortBy;
  showNext: boolean;
  now: number;
  onOpen: (item: Item) => void;
  /** Visible items in display order, for Copy list. */
  onOrder: (items: Item[]) => void;
}

export function ItemList({ items, byId, groupBy, sortBy, showNext, now, onOpen, onOrder }: Props) {
  // Groups sort by their key first; rows inside them by the chosen column.
  const state = useMemo(
    () => ({
      grouping: groupBy === 'none' ? [] : [groupBy],
      sorting: [
        ...(groupBy === 'none' ? [] : [{ id: groupBy, desc: false }]),
        { id: sortBy, desc: sortBy === 'leechScore' },
      ],
    }),
    [groupBy, sortBy],
  );
  const table = useTable({ features, columns, data: items, getRowId, state });
  const rows = table.getRowModel().rows;

  const lines = useMemo(() => {
    const out: Line[] = [];
    for (const row of rows) {
      if (row.getIsGrouped()) {
        out.push({
          kind: 'group',
          label: groupLabel(groupBy, Number(row.groupingValue)),
          count: row.subRows.length,
        });
        for (const sub of row.subRows) out.push({ kind: 'item', item: sub.original });
      } else out.push({ kind: 'item', item: row.original });
    }
    return out;
  }, [rows, groupBy]);

  const ordered = useMemo(() => lines.flatMap((l) => (l.kind === 'item' ? [l.item] : [])), [lines]);
  const onOrderRef = useRef(onOrder);
  useLayoutEffect(() => {
    onOrderRef.current = onOrder;
  });
  useLayoutEffect(() => onOrderRef.current(ordered), [ordered]);

  const listRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // Content above the list (summary, explainer) changes height, so re-measure on resize.
  useLayoutEffect(() => {
    const list = listRef.current!;
    const measure = () => setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list.parentElement!);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: lines.length,
    estimateSize: (i) => (lines[i]!.kind === 'group' ? 36 : 66),
    overscan: 8,
    scrollMargin,
    getItemKey: (i) => {
      const l = lines[i]!;
      return l.kind === 'group' ? `g${l.label}` : l.item.id;
    },
  });

  return (
    <ul
      ref={listRef}
      className={styles.list}
      aria-label="Items"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((v) => {
        const line = lines[v.index]!;
        return (
          <li
            key={v.key}
            ref={virtualizer.measureElement}
            data-index={v.index}
            className={v.index === 0 ? styles.first : undefined}
            style={{ transform: `translateY(${v.start - scrollMargin}px)` }}
          >
            {line.kind === 'group' ? (
              <h3 className={styles.group}>
                {line.label} <span>{line.count}</span>
              </h3>
            ) : (
              <ItemRow item={line.item} byId={byId} showNext={showNext} now={now} onOpen={onOpen} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ItemRow({
  item,
  byId,
  showNext,
  now,
  onOpen,
}: {
  item: Item;
  byId: Map<number, Item>;
  showNext: boolean;
  now: number;
  onOpen: (item: Item) => void;
}) {
  const clock = useClock();
  const alike = item.leech && byId.get(item.lookAlikeIds[0] ?? -1)?.characters;
  const misses = item.leech?.recentMisses;
  return (
    <button type="button" className={styles.row} onClick={() => onOpen(item)}>
      <ItemGlyph item={item} />
      <span className={styles.main}>
        <span className={styles.meaning}>{item.meaning}</span>
        <span className={styles.sub}>
          {item.reading ? `${item.reading}, ` : ''}
          {stageName(item.stage)}
        </span>
        {alike && (
          <span className={styles.alike}>
            Often mixed with <span className={styles.alikeChar}>{alike}</span>
          </span>
        )}
        {!!misses && (
          <span className={styles.alike}>
            Missed {misses} {misses === 1 ? 'time' : 'times'} in the last 14 days
          </span>
        )}
      </span>
      <span className={styles.side}>
        <span className={item.leech ? styles.wrongHigh : styles.wrong}>{item.incorrect} wrong</span>
        <span className={styles.age}>
          {showNext || item.daysIn === null
            ? nextReviewText(item, now, clock)
            : `${item.daysIn} ${item.daysIn === 1 ? 'day' : 'days'} in`}
        </span>
      </span>
    </button>
  );
}
