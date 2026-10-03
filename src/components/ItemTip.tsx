import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../db/useAppMode';
import { buildItems, stageName, type Item } from '../domain/items';
import { useClock } from '../hooks/useClock';
import { useNow } from '../hooks/useNow';
import { Chip } from './Chip';
import { ItemGlyph, nextReviewText } from './ItemSheet';
import styles from './ItemTip.module.css';
import { Tile } from './Tile';

/** Tooltip card for one item: glyph, meaning, reading, stage and next review. */
export function ItemTip({ item, note }: { item: Item; note?: string }) {
  const now = useNow();
  const clock = useClock();
  return (
    <span className={styles.card}>
      <ItemGlyph item={item} />
      <span className={styles.text}>
        <span className={styles.meaning}>{item.meaning}</span>
        {item.reading && <span>{item.reading}</span>}
        <Chip className={styles.chip}>{stageName(item.stage)}</Chip>
        {item.availableAt !== null && (
          <span className={styles.muted}>
            {item.availableAt <= now
              ? 'Available now'
              : `Next review ${nextReviewText(item, now, clock)}`}
          </span>
        )}
        {note && <span className={styles.muted}>{note}</span>}
      </span>
    </span>
  );
}

/** ItemTip by subject id, loading just that subject; `char` alone for kanji outside WaniKani. */
export function SubjectTip({ id, char, note }: { id: number | null; char: string; note?: string }) {
  const db = useDb();
  const item = useLiveQuery(async () => {
    if (id === null) return null;
    const [subject, assignments] = await Promise.all([
      db.subjects.get(id),
      db.assignments.where('data.subject_id').equals(id).toArray(),
    ]);
    if (!subject) return null;
    return (
      buildItems({
        subjects: [subject],
        assignments,
        stats: [],
        leeches: [],
        now: Date.now(),
      })[0] ?? null
    );
  }, [db, id]);
  if (item) return <ItemTip item={item} note={note} />;
  return (
    <span className={styles.card}>
      <Tile char={char} mark="outside" size={44} />
      {note && <span className={styles.muted}>{note}</span>}
    </span>
  );
}
