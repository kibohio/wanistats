// Builds the opt-in coverage data packs (spec section 7) and the built-in sample coverage data.
// Raw downloads are cached in scripts/data/.cache/ so reruns don't hit Jiten again for an
// unchanged revision.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url);
const CACHE = new URL('scripts/data/.cache/', ROOT);
const OUT = new URL('public/data/packs/', ROOT);
const SAMPLE_FILE = new URL('src/packs/sampleCoverage.ts', ROOT);

const JITEN = 'https://api.jiten.moe/api/frequency-list';
const KANJIDIC = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
const KANJI_DATA_COMMIT = '7ada8ddbfe7359286f4db4e766d1242b9e6f7969';
const KANJI_DATA = `https://raw.githubusercontent.com/davidluzgouveia/kanji-data/${KANJI_DATA_COMMIT}/kanji.json`;

const WORDS_LIMIT = 20_000;
const SAMPLE_KANJI = 300;
const SAMPLE_WORDS = 500;

// One words pack per entry. `media` is Jiten's MediaType name (Drama, Movie, VideoGame,
// VisualNovel, Manga, ...), or null for the global list.
const WORD_PACKS = [
  {
    id: 'words-global',
    media: null,
    label: 'Common words, all media',
    description: 'The 20,000 most frequent words across all media in Jiten.',
  },
  {
    id: 'words-anime',
    media: 'Anime',
    label: 'Common words, anime',
    description: 'The 20,000 most frequent words in anime.',
  },
  {
    id: 'words-novel',
    media: 'Novel',
    label: 'Common words, novels',
    description: 'The 20,000 most frequent words in novels.',
  },
];

const KANJI_PACK = {
  id: 'kanji',
  label: 'Kanji frequency and lists',
  description: 'Kanji ranks, Jōyō grades, stroke counts and JLPT levels.',
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(ok, message) {
  if (!ok) throw new Error(message);
}

async function get(url) {
  const res = await fetch(url);
  check(res.ok, `${url}: HTTP ${res.status}`);
  return res;
}

let nextJiten = 0;
// Jiten allows 10 download requests a minute per IP; spacing every call keeps well under it.
async function jiten(path) {
  const wait = nextJiten - Date.now();
  if (wait > 0) await sleep(wait);
  nextJiten = Date.now() + 6_500;
  return get(`${JITEN}/${path}`);
}

async function cached(name, load) {
  const file = new URL(name, CACHE);
  if (existsSync(file)) return readFile(file);
  console.log(`fetch ${name}`);
  const buf = Buffer.from(await (await load()).arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

/** Jiten lists are regenerated in place, so the cache key is the list's published revision. */
async function jitenList(kind, media) {
  const query = media ? `?mediaType=${media}` : '';
  const index = await (await jiten(`${kind === 'kanji' ? 'index-kanji' : 'index'}${query}`)).json();
  const name = `jiten-${kind}-${media ?? 'global'}-${index.revision.replace(/\W+/g, '_')}.csv`;
  const path = `${kind === 'kanji' ? 'download-kanji' : 'download'}${query}${query ? '&' : '?'}downloadType=csv`;
  const buf = await cached(name, () => jiten(path));
  return {
    rows: parseCsv(buf.toString('utf8')),
    source: { name: 'Jiten', revision: index.revision, sha256: sha256(buf) },
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') field += text[i++];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      rows.push([...row, field]);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

/** Data rows sorted by rank (last column, as a number); the header must match. */
function body(rows, header) {
  check(rows[0]?.join() === header, `Unexpected CSV header: ${rows[0]?.join()}`);
  return rows
    .slice(1)
    .map((r) => [...r.slice(0, -1), Number(r.at(-1))])
    .sort((a, b) => a.at(-1) - b.at(-1));
}

const deltas = (ranks) => ranks.map((r, i) => r - (i ? ranks[i - 1] : 0));

function buildWords(rows) {
  const seen = new Set();
  const words = [];
  const readings = [];
  const ranks = [];
  // Homographs repeat a (word, reading) pair; rows are rank-sorted so the first one wins.
  for (const [word, form, rank] of rows) {
    const key = `${word}\t${form}`;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    readings.push(form === word ? '' : form);
    ranks.push(rank);
    if (ranks.length === WORDS_LIMIT) break;
  }
  check(ranks.length === WORDS_LIMIT, `Only ${ranks.length} words`);
  return { words, readings, rank: deltas(ranks) };
}

function parseKanjidic(xml) {
  const map = new Map();
  for (const [, block] of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const literal = block.match(/<literal>(.+?)<\/literal>/)[1];
    // The first stroke_count is the accepted one; later values are common miscounts.
    const strokes = Number(block.match(/<stroke_count>(\d+)<\/stroke_count>/)[1]);
    const grade = Number(block.match(/<grade>(\d+)<\/grade>/)?.[1] ?? 0);
    map.set(literal, { grade, strokes });
  }
  return map;
}

const isJoyo = (grade) => (grade >= 1 && grade <= 6) || grade === 8;

function buildKanji(rows, kanjidic, jlpt) {
  const pack = { chars: [], rank: [], grade: [], strokes: [], jlpt: [] };
  const ranks = [];
  const listed = new Set();
  const add = (char, rank) => {
    const info = kanjidic.get(char);
    listed.add(char);
    pack.chars.push(char);
    ranks.push(rank);
    pack.grade.push(info.grade);
    pack.strokes.push(info.strokes);
    pack.jlpt.push(jlpt[char] ?? 0);
  };
  // Drops simplified Chinese and compatibility ideographs. No NFC: it would merge distinct keys.
  for (const [char, rank] of rows) if (kanjidic.has(char) && !listed.has(char)) add(char, rank);
  // Jōyō and JLPT kanji Jiten never saw still belong in those views, unranked (0).
  for (const [char, info] of kanjidic)
    if (!listed.has(char) && (isJoyo(info.grade) || jlpt[char])) add(char, 0);
  pack.rank = deltas(ranks);

  const joyo = pack.grade.filter(isJoyo).length;
  const perLevel = [5, 4, 3, 2, 1].map((l) => pack.jlpt.filter((j) => j === l).length);
  console.log(`kanji: ${pack.chars.length}, Jōyō ${joyo}, JLPT N5-N1 ${perLevel.join('/')}`);
  check(joyo === 2136, `Expected 2,136 Jōyō kanji, got ${joyo}`);
  check(
    perLevel.every((n) => n > 0),
    'A JLPT level is empty',
  );
  return pack;
}

/** Previous manifest entries, so an unchanged pack keeps its version and file. */
async function previousManifest() {
  try {
    const { packs } = JSON.parse(await readFile(new URL('manifest.json', OUT), 'utf8'));
    return new Map(packs.map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

// ponytail: version is the UTC build date, so two different builds on one day share a version
// and clients won't see the second as an update. Add a suffix if same-day rebuilds ever ship.
const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');

async function writePack(meta, data, sources, previous) {
  const json = Buffer.from(JSON.stringify(data));
  // The hash covers the JSON, so the client can still verify it if a host decompresses in transit.
  const hash = sha256(json);
  const prev = previous.get(meta.id);
  if (prev?.sha256 === hash && existsSync(new URL(prev.file, OUT))) {
    return { ...prev, label: meta.label, description: meta.description };
  }
  const file = `${meta.id}.${today}.json.gz`;
  const gz = gzipSync(json, { level: 9 });
  await writeFile(new URL(file, OUT), gz);
  return {
    id: meta.id,
    label: meta.label,
    description: meta.description,
    version: today,
    file,
    bytes: gz.length,
    uncompressedBytes: json.length,
    sha256: hash,
    records: (data.chars ?? data.words).length,
    sources,
  };
}

/** Top slices of the real packs. Rank deltas slice cleanly because the first value is absolute. */
async function writeSample(kanji, words) {
  const slice = (pack, n) =>
    Object.fromEntries(Object.entries(pack).map(([k, v]) => [k, v.slice(0, n)]));
  await writeFile(
    SAMPLE_FILE,
    `// Generated by scripts/data/refresh.mjs from the kanji and words-global packs. Do not edit.
// Derived from Jiten and KANJIDIC2 data, CC BY-SA 4.0; see public/data/LICENSE-DATA.md.
import type { KanjiPack, WordsPack } from './types';

export const SAMPLE_COVERAGE_LABEL = 'Sample coverage data';

export const sampleKanji: KanjiPack = ${JSON.stringify(slice(kanji, SAMPLE_KANJI))};

export const sampleWords: WordsPack = ${JSON.stringify(slice(words, SAMPLE_WORDS))};
`,
  );
}

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
const previous = await previousManifest();

const kanjidicGz = await cached(`kanjidic2-${today}.xml.gz`, () => get(KANJIDIC));
const kanjidicXml = gunzipSync(kanjidicGz).toString('utf8');
const kanjidicSource = {
  name: 'KANJIDIC2',
  revision: kanjidicXml.match(/<database_version>(.+?)<\/database_version>/)[1],
  sha256: sha256(kanjidicGz),
};

const kanjiDataBuf = await cached(`kanji-data-${KANJI_DATA_COMMIT}.json`, () => get(KANJI_DATA));
const jlpt = Object.fromEntries(
  Object.entries(JSON.parse(kanjiDataBuf.toString('utf8')))
    .filter(([, v]) => v.jlpt_new)
    .map(([k, v]) => [k, v.jlpt_new]),
);
const jlptSource = {
  name: 'kanji-data',
  revision: KANJI_DATA_COMMIT,
  sha256: sha256(kanjiDataBuf),
};

const kanjiList = await jitenList('kanji', null);
const kanji = buildKanji(body(kanjiList.rows, 'Kanji,Rank'), parseKanjidic(kanjidicXml), jlpt);
const sources = [kanjiList.source, kanjidicSource, jlptSource];
const entries = [await writePack(KANJI_PACK, kanji, sources, previous)];

let globalWords;
for (const meta of WORD_PACKS) {
  const list = await jitenList('words', meta.media);
  const words = buildWords(body(list.rows, 'Word,Form,Rank'));
  if (meta.id === 'words-global') globalWords = words;
  entries.push(await writePack(meta, words, [list.source], previous));
}

const files = new Set(entries.map((e) => e.file));
for (const name of await readdir(OUT))
  if (name.endsWith('.json.gz') && !files.has(name)) await rm(new URL(name, OUT));
await writeFile(new URL('manifest.json', OUT), `${JSON.stringify({ packs: entries }, null, 2)}\n`);
await writeSample(kanji, globalWords);

for (const e of entries)
  console.log(`${e.file}: ${e.records} records, ${e.uncompressedBytes} B raw, ${e.bytes} B gzip`);
