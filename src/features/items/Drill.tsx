import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toKana } from 'wanakana';
import { buttonClass } from '../../components/Button';
import { ItemGlyph } from '../../components/ItemSheet';
import { Sheet } from '../../components/Sheet';
import { advance, checkAnswer, startDrill, type Verdict } from '../../domain/drill';
import type { Item } from '../../domain/items';
import { plural } from '../../format';
import styles from './Drill.module.css';

const TYPE_NAME = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Vocabulary',
} as const;

type Graded = Exclude<Verdict, 'retry'>;

interface Props {
  items: Item[];
  onClose: () => void;
}

/** Local self-study over a list of items. Nothing is sent to WaniKani or saved. */
export default function Drill({ items: initial, onClose }: Props) {
  const [items, setItems] = useState(initial);
  const [state, setState] = useState(() => startDrill(initial));
  const [value, setValue] = useState('');
  const [graded, setGraded] = useState<Graded | null>(null);
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const question = state.queue[0];
  const item = question && byId.get(question.itemId);
  const finished = !item;
  // Runs after the sheet focuses its close button, so typing can start straight away.
  useEffect(() => {
    if (!finished) inputRef.current?.focus();
  }, [finished]);

  const restart = (next: Item[]) => {
    setItems(next);
    setState(startDrill(next));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!item || !question) return;
    if (graded) {
      setState(advance(state, graded));
      setGraded(null);
      setValue('');
      return;
    }
    if (!value.trim()) return;
    const answer = question.kind === 'reading' ? toKana(value) : value;
    const verdict = checkAnswer(item, question.kind, answer);
    if (verdict === 'retry') {
      setHint(
        question.kind === 'meaning' ? 'Answer with the meaning in English.' : 'Answer in kana.',
      );
      return;
    }
    setValue(answer);
    setGraded(verdict);
    setHint('');
  };

  if (finished) {
    const missed = state.missed.flatMap((id) => byId.get(id) ?? []);
    return (
      <Sheet open onClose={onClose} title="Drill done">
        <div className={styles.body}>
          <p className={styles.score}>
            {items.length - missed.length} of {plural(items.length, 'item')} right first time
          </p>
          <p className={styles.sub}>
            {state.correct} of {plural(state.answers, 'answer')} right
          </p>
          {missed.length > 0 && (
            <section aria-label="Missed" className={styles.missed}>
              <h3>Missed</h3>
              <ul>
                {missed.map((i) => (
                  <li key={i.id}>
                    <ItemGlyph item={i} />
                    <span>{i.meaning}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className={styles.actions}>
            {missed.length > 0 && (
              <button
                type="button"
                className={buttonClass('primary')}
                onClick={() => restart(missed)}
              >
                Drill missed items again
              </button>
            )}
            <button type="button" className={buttonClass('secondary')} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  const reading = question!.kind === 'reading';
  const answers = reading ? item.readings.map((r) => r.reading) : item.meanings;
  const status =
    graded === 'correct'
      ? 'Correct'
      : graded === 'typo'
        ? `Close enough. ${answers[0]}`
        : graded === 'wrong'
          ? `Not quite. ${answers.join(', ')}`
          : hint;

  return (
    <Sheet open onClose={onClose} title="Drill">
      <form className={styles.body} onSubmit={submit}>
        <p className={styles.progress}>{plural(state.queue.length, 'question')} left</p>
        <div className={styles.glyph}>
          <ItemGlyph item={item} size="large" />
        </div>
        <label htmlFor="drill-answer" className={styles.prompt}>
          {TYPE_NAME[item.type]} <strong>{reading ? 'reading' : 'meaning'}</strong>
        </label>
        <input
          ref={inputRef}
          id="drill-answer"
          className={styles.input}
          data-verdict={graded ?? undefined}
          lang={reading ? 'ja' : 'en'}
          placeholder={reading ? '答え' : 'Your answer'}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          readOnly={graded !== null}
          value={value}
          onChange={(e) => {
            setHint('');
            setValue(reading ? toKana(e.target.value, { IMEMode: true }) : e.target.value);
          }}
        />
        <p role="status" className={styles.status} data-verdict={graded ?? undefined}>
          {status}
        </p>
        <button type="submit" className={buttonClass('primary')}>
          {graded ? 'Next' : 'Check'}
        </button>
      </form>
    </Sheet>
  );
}
