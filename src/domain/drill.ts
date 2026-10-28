import { hiragana, type Item } from './items';

export type QuestionKind = 'meaning' | 'reading';

export interface Question {
  itemId: number;
  kind: QuestionKind;
}

/** `typo` counts as correct; `retry` asks again without counting, e.g. kana typed for a meaning. */
export type Verdict = 'correct' | 'typo' | 'wrong' | 'retry';

export interface DrillState {
  queue: Question[];
  /** Items missed at least once, in the order first missed. */
  missed: number[];
  answers: number;
  correct: number;
}

/** A missed question comes back this many questions later, or last when fewer remain. */
export const REQUEUE_GAP = 4;

/** Radicals and kana-only words have no reading to ask. */
export const kindsFor = (item: Item): QuestionKind[] =>
  item.readings.length ? ['meaning', 'reading'] : ['meaning'];

/** Fisher-Yates, in place. */
export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export function startDrill(items: Item[], random: () => number = Math.random): DrillState {
  const queue = items.flatMap((i) => kindsFor(i).map((kind) => ({ itemId: i.id, kind })));
  return { queue: shuffle(queue, random), missed: [], answers: 0, correct: 0 };
}

/** Takes the current question off the queue; a wrong one goes back in further down. */
export function advance(state: DrillState, verdict: Exclude<Verdict, 'retry'>): DrillState {
  const [head, ...rest] = state.queue;
  if (!head) return state;
  const right = verdict !== 'wrong';
  if (!right) rest.splice(Math.min(REQUEUE_GAP, rest.length), 0, head);
  return {
    queue: rest,
    missed:
      right || state.missed.includes(head.itemId) ? state.missed : [...state.missed, head.itemId],
    answers: state.answers + 1,
    correct: state.correct + Number(right),
  };
}

const normalMeaning = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

// WaniKani's own allowance: none up to 3 letters, then more as the answer grows.
function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 7) return 2;
  return 2 + Math.floor(length / 7);
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + Number(a[i - 1] !== b[j - 1]),
      );
    prev = row;
  }
  return prev[b.length]!;
}

const JAPANESE = /[぀-ヿ一-鿿]/;

/** Grades an answer. Reading input should already be kana (wanakana's toKana). */
export function checkAnswer(item: Item, kind: QuestionKind, input: string): Verdict {
  if (kind === 'reading') {
    const answer = hiragana(input.trim());
    if (!answer || /[a-z]/i.test(answer)) return 'retry';
    return item.readings.some((r) => hiragana(r.reading) === answer) ? 'correct' : 'wrong';
  }
  if (JAPANESE.test(input)) return 'retry';
  const answer = normalMeaning(input);
  if (!answer) return 'retry';
  const meanings = item.meanings.map(normalMeaning);
  if (meanings.includes(answer)) return 'correct';
  return meanings.some((m) => distance(m, answer) <= tolerance(m.length)) ? 'typo' : 'wrong';
}
