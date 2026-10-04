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
import { ItemTip } from '../../components/ItemTip';
import { Tooltip } from '../../components/Tooltip';
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

const GAP = 8;
const MIN_CARD = 104;
const MAX_COLS = 8;

type Line = { kind: 'group'; label: string; count: number } | { kind: 'item'; item: Item };
type Row = { kind: 'group'; label: string; count: number } | { kind: 'cards'; items: Item[] };

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
  const tableRows = table.getRowModel().rows;

  const lines = useMemo(() => {
    const out: Line[] = [];
    for (const row of tableRows) {
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
  }, [tableRows, groupBy]);

  const ordered = useMemo(() => lines.flatMap((l) => (l.kind === 'item' ? [l.item] : [])), [lines]);
  const onOrderRef = useRef(onOrder);
  useLayoutEffect(() => {
    onOrderRef.current = onOrder;
  });
  useLayoutEffect(() => onOrderRef.current(ordered), [ordered]);

  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState({ width: 0, top: 0 });
  // Content above the grid (summary, explainer) changes height, and the width sets the columns.
  useLayoutEffect(() => {
    const el = listRef.current!;
    const update = () => {
      const r = el.getBoundingClientRect();
      const next = { width: r.width, top: r.top + window.scrollY };
      setBox((b) => (b.width === next.width && b.top === next.top ? b : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const cols = Math.min(MAX_COLS, Math.max(2, Math.floor((box.width + GAP) / (MIN_CARD + GAP))));
  const rows = useMemo(() => {
    const out: Row[] = [];
    let run: Item[] = [];
    const flush = () => {
      for (let i = 0; i < run.length; i += cols)
        out.push({ kind: 'cards', items: run.slice(i, i + cols) });
      run = [];
    };
    for (const l of lines) {
      if (l.kind === 'item') run.push(l.item);
      else {
        flush();
        out.push(l);
      }
    }
    flush();
    return out;
  }, [lines, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]!.kind === 'group' ? 40 : 150),
    overscan: 4,
    scrollMargin: box.top,
    getItemKey: (i) => {
      const r = rows[i]!;
      return r.kind === 'group' ? `g${r.label}` : `${cols}:${r.items[0]!.id}`;
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
        const row = rows[v.index]!;
        return (
          <li
            key={v.key}
            ref={virtualizer.measureElement}
            data-index={v.index}
            style={{ transform: `translateY(${v.start - box.top}px)` }}
          >
            {row.kind === 'group' ? (
              <h3 className={styles.group}>
                {row.label} <span>{row.count}</span>
              </h3>
            ) : (
              <div
                className={styles.cards}
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {row.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    byId={byId}
                    showNext={showNext}
                    now={now}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ItemCard({
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
    <Tooltip
      content={<ItemTip item={item} note={alike ? `Often mixed with ${alike}` : undefined} />}
    >
      <button
        type="button"
        className={styles.card}
        data-len={Math.min(item.characters?.length ?? 1, 4)}
        onClick={() => onOpen(item)}
      >
        <ItemGlyph item={item} />
        <span className={styles.meaning}>{item.meaning}</span>
        {item.reading && <span className={styles.sub}>{item.reading}</span>}
        <span className={styles.sub}>{stageName(item.stage)}</span>
        {item.leech && <span className={styles.wrong}>{item.incorrect} wrong</span>}
        {!!misses && (
          <span className={styles.misses}>
            Missed {misses} {misses === 1 ? 'time' : 'times'} in 14 days
          </span>
        )}
        {(showNext || !item.leech) && (
          <span className={styles.age}>
            {showNext || item.daysIn === null
              ? nextReviewText(item, now, clock)
              : `${item.daysIn} ${item.daysIn === 1 ? 'day' : 'days'} in`}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
