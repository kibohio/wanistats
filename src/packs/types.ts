// Pack shapes as written by scripts/data/refresh.mjs. Parallel arrays, one index per record.

export interface KanjiPack {
  chars: string[];
  /** Jiten rank, delta-encoded (first value absolute). 0 = unranked. */
  rank: number[];
  /** KANJIDIC2 grade: 1-6 Kyōiku, 8 rest of Jōyō, 9-10 Jinmeiyō, 0 none. */
  grade: number[];
  strokes: number[];
  /** Unofficial JLPT level, 5..1 = N5..N1, 0 none. */
  jlpt: number[];
}

export interface WordsPack {
  words: string[];
  /** Main kana reading; '' when the word is kana-only (reading equals spelling). */
  readings: string[];
  /** Jiten rank, delta-encoded (first value absolute). */
  rank: number[];
}

export interface PackSource {
  name: string;
  revision: string;
  /** sha256 of the raw source file the pack was built from. */
  sha256: string;
}

export interface PackEntry {
  id: string;
  label: string;
  description: string;
  /** Build date, YYYYMMDD. Later versions compare greater as strings. */
  version: string;
  file: string;
  /** Exact size of the .gz file. */
  bytes: number;
  uncompressedBytes: number;
  /** sha256 of the uncompressed JSON. */
  sha256: string;
  records: number;
  sources: PackSource[];
}

export interface PackManifest {
  packs: PackEntry[];
}
