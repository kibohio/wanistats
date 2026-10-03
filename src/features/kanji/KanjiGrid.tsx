import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { KanjiCell, KanjiGroup } from '../../domain/coverage';
import { SubjectTip } from '../../components/ItemTip';
import { Tooltip } from '../../components/Tooltip';
import styles from './Kanji.module.css';
import { num } from './parts';

const GAP = 5;
const HEAD = 52;
const MIN_CELL = 46;
const MIN_COLS = 8;

type Row = { kind: 'head'; group: KanjiGroup } | { kind: 'cells'; cells: KanjiCell[] };

export interface GridHandle {
  scrollToGroup: (key: string) => void;
}

interface Props {
  groups: KanjiGroup[];
  selected: KanjiCell | null;
  onSelect: (cell: KanjiCell) => void;
  ariaFor: (cell: KanjiCell) => string;
  ref?: Ref<GridHandle>;
}

/** Practice-paper grid, one virtual row per group heading or line of cells, scrolled by the window. */
export function KanjiGrid({ groups, selected, onSelect, ariaFor, ref }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, top: 0 });

  useLayoutEffect(() => {
    const el = listRef.current!;
    const update = () => {
      const r = el.getBoundingClientRect();
      const next = { width: r.width, top: r.top + window.scrollY };
      setBox((b) => (b.width === next.width && b.top === next.top ? b : next));
    };
    update();
    // The body observer catches content above the grid changing height.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(MIN_COLS, Math.floor((box.width + GAP) / (MIN_CELL + GAP)));
  const cell = box.width ? (box.width - GAP * (cols - 1)) / cols : MIN_CELL;

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const group of groups) {
      out.push({ kind: 'head', group });
      for (let i = 0; i < group.cells.length; i += cols) {
        out.push({ kind: 'cells', cells: group.cells.slice(i, i + cols) });
      }
    }
    return out;
  }, [groups, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i].kind === 'head' ? HEAD : cell + GAP),
    overscan: 6,
    scrollMargin: box.top,
  });
  useEffect(() => virtualizer.measure(), [virtualizer, rows, cell]);

  useImperativeHandle(ref, () => ({
    scrollToGroup: (key) => {
      const i = rows.findIndex((r) => r.kind === 'head' && r.group.key === key);
      const offset = i >= 0 && virtualizer.getOffsetForIndex(i, 'start')?.[0];
      if (offset === false || offset === undefined) return;
      // The strip only sticks once the page has scrolled, so measure again after the first jump.
      const go = () => window.scrollTo({ top: offset - stickyTop() });
      go();
      requestAnimationFrame(go);
    },
  }));

  return (
    <div ref={listRef} className={styles.grid} style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];
        return (
          <div
            key={item.key}
            className={styles.gridRow}
            style={{ height: item.size, transform: `translateY(${item.start - box.top}px)` }}
          >
            {row.kind === 'head' ? (
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>{row.group.label}</h2>
                <span className={styles.groupAside}>
                  {num(row.group.known)} of {num(row.group.total)} known
                </span>
              </div>
            ) : (
              <div
                className={styles.cells}
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}
              >
                {row.cells.map((c) => (
                  <Tooltip
                    key={c.char}
                    content={
                      <SubjectTip
                        id={c.subjectId}
                        char={c.char}
                        note={c.inWaniKani ? undefined : 'Not in WaniKani'}
                      />
                    }
                  >
                    <button
                      type="button"
                      className={styles.cell}
                      data-stage={c.inWaniKani ? c.stage : 'none'}
                      aria-label={ariaFor(c)}
                      aria-pressed={selected?.char === c.char}
                      style={{ height: cell }}
                      onClick={() => onSelect(c)}
                    >
                      {c.char}
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Bottom edge of whatever is stuck to the top of the viewport (the sample strip), so a jump lands below it. */
function stickyTop(): number {
  for (let el = document.elementFromPoint(window.innerWidth / 2, 1); el; el = el.parentElement) {
    if (getComputedStyle(el).position === 'sticky') return el.getBoundingClientRect().bottom;
  }
  return 0;
}
