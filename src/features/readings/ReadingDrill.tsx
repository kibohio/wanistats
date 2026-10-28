import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toKana } from 'wanakana';
import { buttonClass } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Tile } from '../../components/Tile';
import { advance, type DrillState } from '../../domain/drill';
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

/** Worst first; a miss comes back later until it is answered right. Nothing is saved. */
export default function ReadingDrill({
  leeches,
  onClose,
}: {
  leeches: ReadingLeech[];
  onClose: () => void;
}) {
  const [state, setState] = useState(() => start(leeches));
  const [showWord, setShowWord] = useState(false);
  const [value, setValue] = useState('');
  const [graded, setGraded] = useState<Graded | null>(null);
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = new Map(leeches.map((l) => [l.subjectId, l]));
  const leech = state.queue[0] && byId.get(state.queue[0].itemId);
  // Runs after the sheet focuses its close button, so typing can start straight away.
  useEffect(() => {
    if (leech) inputRef.current?.focus();
  }, [leech]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!leech) return;
    if (graded) {
      setState(advance(state, graded.kind === 'correct' ? 'correct' : 'wrong'));
      setShowWord(false);
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
  };

  if (!leech) {
    const missed = state.missed.flatMap((id) => byId.get(id) ?? []);
    return (
      <Sheet open onClose={onClose} className={styles.sheet} title="Drill done">
        <div className={styles.body}>
          <p className={styles.score}>
            {leeches.length - missed.length} of {plural(leeches.length, 'reading')} right first time
          </p>
          <p className={styles.sub}>
            {state.correct} of {plural(state.answers, 'answer')} right
          </p>
          {missed.length > 0 && (
            <section aria-label="Missed" className={styles.missed}>
              <h3>Missed</h3>
              <ul>
                {missed.map((l) => (
                  <li key={l.subjectId}>
                    <Tile char={l.characters} srsStage={l.srsStage} size={44} />
                    <span lang="ja">{l.targetReadings.join('、')}</span>
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
                onClick={() => setState(start(missed))}
              >
                Drill missed kanji again
              </button>
            )}
            <button type="button" className={buttonClass('secondary')} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

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
        <p className={styles.progress}>{plural(state.queue.length, 'question')} left</p>
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
        {!graded && leech.anchor && (
          <p className={styles.prompt}>
            {showWord ? (
              // The word's reading would give the answer away.
              <>
                <span lang="ja">{leech.anchor.characters}</span> · {leech.anchor.meaning}
              </>
            ) : (
              <button
                type="button"
                className={buttonClass('secondary', true)}
                onClick={() => {
                  setShowWord(true);
                  inputRef.current?.focus();
                }}
              >
                Show a word that uses it
              </button>
            )}
          </p>
        )}
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

const start = (leeches: ReadingLeech[]): DrillState => ({
  queue: leeches.map((l) => ({ itemId: l.subjectId, kind: 'reading' })),
  missed: [],
  answers: 0,
  correct: 0,
});
