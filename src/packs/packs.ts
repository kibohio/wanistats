import { PACKS_MANIFEST } from '../config';
import { openPacksDb, type PackRow } from '../db/schema';
import type { PackEntry, PackManifest } from './types';

export const packsDb = openPacksDb();

const PACKS_DIR = PACKS_MANIFEST.slice(0, PACKS_MANIFEST.lastIndexOf('/') + 1);
const OFFLINE = 'The download failed. Check your connection and try again.';

export async function fetchManifest(): Promise<PackManifest> {
  const res = await fetch(PACKS_MANIFEST).catch(() => {
    throw new Error("Couldn't load the list of data packs. Check your connection and try again.");
  });
  if (!res.ok)
    throw new Error(`Couldn't load the list of data packs (HTTP ${res.status}). Try again later.`);
  return res.json();
}

/**
 * Fetches a pack, verifies and decodes it, and stores it in `wanistats-packs`. Errors carry
 * copy for the user; an abort rethrows the AbortError.
 */
export async function downloadPack(
  entry: PackEntry,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PackRow> {
  const offline = (e: unknown): never => {
    throw signal?.aborted ? e : new Error(OFFLINE);
  };
  const res = await fetch(PACKS_DIR + entry.file, { signal }).catch(offline);
  if (!res.ok || !res.body) {
    throw new Error(`The server couldn't send this data (HTTP ${res.status}). Try again later.`);
  }
  const raw = await readAll(res.body, entry.bytes, onProgress).catch(offline);

  // A host that decompressed the file in transit hands over plain JSON.
  const isGzip = raw[0] === 0x1f && raw[1] === 0x8b;
  const json = isGzip
    ? await gunzip(raw).catch(() => {
        throw new Error("Couldn't read the downloaded file, so it wasn't saved. Try again.");
      })
    : raw;
  // crypto.subtle only exists in secure contexts (https, localhost). On plain http, such as a
  // phone hitting the dev server over the LAN, skip the checksum; the gzip check and JSON
  // parse below still reject a damaged file.
  if (globalThis.crypto?.subtle && (await sha256(json)) !== entry.sha256) {
    throw new Error("The download failed its integrity check, so it wasn't saved. Try again.");
  }

  const row: PackRow = {
    id: entry.id,
    version: entry.version,
    data: JSON.parse(new TextDecoder().decode(json)),
    bytes: entry.bytes,
    installedAt: new Date().toISOString(),
  };
  await packsDb.packs.put(row).catch(() => {
    throw new Error(
      "There's no room on this device for the data. Free up some storage and try again.",
    );
  });
  return row;
}

async function readAll(
  body: ReadableStream<Uint8Array>,
  total: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = body.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    chunks.push(r.value);
    loaded += r.value.length;
    onProgress?.(Math.min(loaded, total), total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    const { gunzipSync } = await import('fflate');
    return new Uint8Array(gunzipSync(bytes));
  }
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function deletePack(id: string): Promise<void> {
  return packsDb.packs.delete(id);
}

export function hasUpdate(entry: PackEntry, installed: PackRow | undefined): boolean {
  return installed !== undefined && entry.version > installed.version;
}

/** Approximate bytes a pack takes in IndexedDB: its JSON size. */
export function sizeOnDevice(row: PackRow): number {
  return new TextEncoder().encode(JSON.stringify(row.data)).length;
}

export function storageUsed(rows: PackRow[]): number {
  return rows.reduce((sum, row) => sum + sizeOnDevice(row), 0);
}

/** "48 KB": decimal units, as file managers show them. */
export function formatBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 999_500) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1e6).toFixed(1)} MB`;
}
