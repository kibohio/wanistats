import { ExternalIcon } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { stageName, type Item } from '../../domain/items';
import { ItemGlyph, nextReviewText } from './ItemList';
import styles from './Items.module.css';

const READING_TYPE = { onyomi: "On'yomi", kunyomi: "Kun'yomi", nanori: 'Nanori' } as const;

interface Props {
  item: Item | null;
  byId: Map<number, Item>;
  now: number;
  onClose: () => void;
  onOpen: (item: Item) => void;
}

export function ItemSheet({ item, byId, now, onClose, onOpen }: Props) {
  if (!item) return null;
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
  const facts: [string, string][] = [
    ['Meanings', item.meanings.join(', ')],
    ...readings.map((g): [string, string] => [g.label, g.list.join(', ')]),
    ['Stage', stageName(item.stage)],
    ['Level', String(item.level)],
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
    ['Next review', nextReviewText(item, now)],
  ];
  const alikes = item.lookAlikeIds.flatMap((id) => byId.get(id) ?? []);

  return (
    <Sheet open onClose={onClose} title={item.meaning}>
      <div className={styles.sheetBody}>
        <ItemGlyph item={item} size="large" />
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {alikes.length > 0 && (
          <div className={styles.alikes}>
            <h3 className={styles.factHead}>Look-alikes</h3>
            <div className={styles.alikeTiles}>
              {alikes.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={styles.alikeButton}
                  onClick={() => onOpen(x)}
                >
                  <ItemGlyph item={x} />
                  <span>
                    {x.meaning}, {stageName(x.stage)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {item.documentUrl && (
          <a href={item.documentUrl} target="_blank" rel="noreferrer" className={styles.external}>
            Open in WaniKani <ExternalIcon />
          </a>
        )}
      </div>
    </Sheet>
  );
}
