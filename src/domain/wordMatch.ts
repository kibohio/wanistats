import type { SubjectResource } from '../api/types';
import type { WordsPack } from './coverage';

const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * Pack row index -> WaniKani subject id. Vocabulary matches by exact spelling (〜 stripped);
 * when several rows share a spelling, the row whose reading WaniKani accepts wins, else the
 * best-ranked one. Kana vocabulary matches only kana-only rows. A kanji word never claims
 * the separate kana-written row (事 vs こと), per DECISIONS.
 */
export function matchWords(subjects: SubjectResource[], pack: WordsPack): Map<number, number> {
  const rowsBySpelling = new Map<string, number[]>();
  pack.words.forEach((w, i) => {
    const rows = rowsBySpelling.get(w);
    if (rows) rows.push(i);
    else rowsBySpelling.set(w, [i]);
  });

  const out = new Map<number, number>();
  for (const s of subjects) {
    if (s.data.hidden_at || !s.data.characters) continue;
    if (s.object !== 'vocabulary' && s.object !== 'kana_vocabulary') continue;
    const rows = rowsBySpelling.get(s.data.characters.replace(/[〜～]/g, '')) ?? [];
    let row: number | undefined;
    if (s.object === 'kana_vocabulary') {
      row = rows.find((i) => pack.readings[i] === '');
    } else {
      const accepted = new Set(
        s.data.readings.filter((r) => r.accepted_answer).map((r) => toHiragana(r.reading)),
      );
      row =
        rows.find((i) => accepted.has(toHiragana(pack.readings[i] || pack.words[i]))) ?? rows[0];
    }
    if (row !== undefined && !out.has(row)) out.set(row, s.id);
  }
  return out;
}
