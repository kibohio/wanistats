import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toKana } from 'wanakana';
import { buttonClass } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Tile } from '../../components/Tile';
import { checkReading, type ReadingLeech, type ReadingVerdict } from '../../domain/onyomi';
import { plural } from '../../format';
import styles from '../items/Drill.module.css';
import { AnchorLine } from './ReadingsScreen';

type Graded = Exclude<ReadingVerdict, { kind: 'retry' }>;

const NEAR_MISS = {
  kunyomi: "That's the kun'yomi. This drill wants the on'yomi.",
  nanori: "That's a name reading. This drill wants the on'yomi.",
  onyomi: "WaniKani doesn't accept that on'yomi here.",
};

/** One pass over the leeches, worst first. Nothing is saved. */
export default function ReadingDrill({
  leeches,
  onClose,
}: {
  leeches: ReadingLeech[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [value, setValue] = useState('');
  const [graded, setGraded] = useState<Graded | null>(null);
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const leech = leeches[index];
  // Runs after the sheet focuses its close button, so typing can start straight away.
  useEffect(() => {
    if (leech) inputRef.current?.focus();
  }, [leech]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!leech) return;
    if (graded) {
      setIndex(index + 1);
      setGraded(null);
      setValue('');
      return;
    }
    const answer = toKana(value);
    const verdict = checkReading(leech, answer);
    if (verdict.kind === 'retry') {
      if (value.trim()) setHint('Answer in kana.');
      return;
    }
    setValue(answer);
    setGraded(verdict);
    setHint('');
    if (verdict.kind === 'correct') setCorrect(correct + 1);
  };

  if (!leech)
    return (
      <Sheet open onClose={onClose} className={styles.sheet} title="Drill done">
        <div className={styles.body}>
          <p className={styles.score}>
            {correct} of {plural(leeches.length, 'reading')} right
          </p>
          <div className={styles.actions}>
            <button type="button" className={buttonClass('primary')} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Sheet>
    );

  const verdict = graded?.kind === 'correct' ? 'correct' : graded && 'wrong';
  const status =
    graded?.kind === 'correct'
      ? 'Correct'
      : graded?.kind === 'other'
        ? NEAR_MISS[graded.type]
        : graded
          ? 'Not quite.'
          : hint;

  return (
    <Sheet open onClose={onClose} className={styles.sheet} title="On'yomi drill">
      <form className={styles.body} onSubmit={submit}>
        <p className={styles.progress}>
          {index + 1} of {leeches.length}
        </p>
        <div className={styles.glyph} lang="ja">
          <Tile char={leech.characters} srsStage={leech.srsStage} />
        </div>
        <label htmlFor="reading-answer" className={styles.prompt}>
          {leech.meaning}: <strong>on&apos;yomi</strong>
        </label>
        <input
          ref={inputRef}
          id="reading-answer"
          className={styles.input}
          data-verdict={verdict ?? undefined}
          lang="ja"
          placeholder="答え"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          readOnly={graded !== null}
          value={value}
          onChange={(e) => {
            setHint('');
            setValue(toKana(e.target.value, { IMEMode: true }));
          }}
        />
        <p role="status" className={styles.status} data-verdict={verdict ?? undefined}>
          {status}
        </p>
        {graded && (
          <p className={styles.prompt}>
            <span lang="ja">
              {leech.characters} → {leech.targetReadings.join('、')}
            </span>
            {leech.anchor && (
              <>
                <br />
                <AnchorLine leech={leech} />
              </>
            )}
          </p>
        )}
        <button type="submit" className={buttonClass('primary')}>
          {graded ? 'Next' : 'Check'}
        </button>
      </form>
    </Sheet>
  );
}
