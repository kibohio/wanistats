// Pack shapes as written by scripts/data/refresh.mjs. Parallel arrays, one index per record.

export type { KanjiPack, WordsPack } from '../domain/coverage';

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
