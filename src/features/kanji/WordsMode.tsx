import { usePref } from '../../db/prefs';
import { useId, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAssignments, useSnapshots, useSubjects } from '../../db/hooks';
import { useAppMode } from '../../db/useAppMode';
import { coverageGrowth, wordCoverage, type WordRow } from '../../domain/coverage';
import { useNow } from '../../hooks/useNow';
import { useInstalledPacks, useManifest, usePack } from '../../packs/hooks';
import { SAMPLE_COVERAGE_LABEL, sampleWords } from '../../packs/sampleCoverage';
import { DownloadSheet } from '../packs/DownloadSheet';
import { PackEmptyState, PackUpdateLine } from '../packs/PackPrompts';
import styles from './Kanji.module.css';
import { CoverageBars, Estimated, Explained, num, pctText } from './parts';
import { knownRange } from './stage';
import { plural } from '../../format';

type WordsPackId = `words-${string}`;

const SIZES = [1000, 5000, 10000];
// The built-in sample list has 500 words.
const SAMPLE_SIZES = [100, 250, 500];
const PAGE_SIZES = [24, 48, 96];

const WHERE: Record<string, string> = {
  'words-global': 'Japanese media',
  'words-anime': 'anime',
  'words-novel': 'novels',
};

export function WordsMode() {
  const sampleMode = useAppMode() === 'sample';
  const manifest = useManifest().data;
  const installedRows = useInstalledPacks();
  const [picked, setMedia] = useState<WordsPackId>('words-global');
  const [sheet, setSheet] = useState(false);
  const [wanted] = usePref('wordMedia');

  // Only the media lists chosen in Settings, Preferences.
  const wordPacks =
    manifest?.packs.filter(
      (p) => p.id.startsWith('words-') && wanted.includes(p.id.slice('words-'.length)),
    ) ?? [];
  const installedIds = new Set(installedRows?.map((r) => r.id));
  const options = wordPacks
    .filter((p) => installedIds.has(p.id) || (p.id === 'words-global' && sampleMode))
    .map((p) => ({ value: p.id as WordsPackId, label: shortLabel(p.label) }));
  const media = options.some((o) => o.value === picked) ? picked : (options[0]?.value ?? picked);
  const missing = wordPacks.filter((p) => !installedIds.has(p.id)).map((p) => p.id);

  return (
    <>
      {options.length > 1 && (
        <SegmentedControl label="Media" options={options} value={media} onChange={setMedia} />
      )}
      {missing.length > 0 && options.length > 0 && (
        <p className={styles.caption}>
          <Button small onClick={() => setSheet(true)}>
            Download more media lists
          </Button>
          <DownloadSheet open={sheet} onClose={() => setSheet(false)} preselect={missing} />
        </p>
      )}
      <WordsView key={media} packId={media} sampleMode={sampleMode} />
    </>
  );
}

// "Common words, anime" -> "Anime"; the global list reads "Global".
function shortLabel(label: string) {
  const tail = label.split(', ').pop() ?? label;
  return tail === 'all media' ? 'Global' : tail.charAt(0).toUpperCase() + tail.slice(1);
}

function WordsView({ packId, sampleMode }: { packId: WordsPackId; sampleMode: boolean }) {
  const subjects = useSubjects();
  const assignments = useAssignments();
  const snapshots = useSnapshots();
  const now = useNow();
  const installed = usePack(packId);
  const isSample = installed === null && sampleMode && packId === 'words-global';
  const pack = isSample ? sampleWords : installed;
  const [knownStage] = usePref('knownStage');

  const coverage = useMemo(() => {
    if (!pack || !subjects || !assignments) return null;
    const sizes = isSample ? SAMPLE_SIZES : SIZES;
    return wordCoverage(subjects, assignments, pack, sizes, knownStage);
  }, [pack, subjects, assignments, isSample, knownStage]);
  const growth = useMemo(
    () => (snapshots ? coverageGrowth(snapshots, now) : null),
    [snapshots, now],
  );

  if (installed === undefined) return null;
  if (!pack) {
    return (
      <PackEmptyState packId={packId}>
        Word coverage needs a list of common words. The WK level view in Kanji works without a
        download.
      </PackEmptyState>
    );
  }
  if (!coverage) return null;

  const headline = coverage.top[1] ?? coverage.top[0];
  const where = WHERE[packId] ?? 'this list';
  return (
    <>
      {isSample && (
        <p className={styles.caption}>
          <Chip>{SAMPLE_COVERAGE_LABEL}</Chip>
        </p>
      )}
      {installed && <PackUpdateLine packId={packId} />}
      <CoverageBars
        label="Coverage of the most common words"
        bars={coverage.top.map((t) => ({
          key: String(t.size),
          label: `Top ${num(t.size)}`,
          pct: t.pct,
          known: t.known,
          total: t.size,
        }))}
      />
      {headline && (
        <p className={styles.line}>
          {isSample ? "The sample's" : 'Your'}{' '}
          {knownStage === 5
            ? "Guru'd WaniKani vocabulary"
            : `WaniKani vocabulary at ${knownRange(knownStage)}`}{' '}
          covers <strong>{pctText(headline.pct)}</strong> of the {num(headline.size)} most common
          words in {where}.
        </p>
      )}
      <Explained
        how={
          <p>
            Common words count for more. Jiten only publishes frequency ranks, so each word is
            weighted 1 ÷ rank (Zipf&apos;s law), which makes this an estimate. WaniKani words match
            by exact spelling, kana-only words by reading.
          </p>
        }
      >
        Weighted by how often each word shows up, that&apos;s{' '}
        <strong>{pctText(coverage.weighted.pct)}</strong> of the words you&apos;ll actually see.{' '}
        <Estimated />
      </Explained>
      <p className={styles.note}>
        This counts only WaniKani vocabulary at {knownRange(knownStage)}, not words learned
        elsewhere.
      </p>
      {growth && growth.days > 0 && (
        <p className={styles.line}>
          {growth.vocab >= 0 ? '+' : ''}
          {num(growth.vocab)} WaniKani words known{knownStage > 5 && ' at Guru'} in the last{' '}
          {growth.days === 1 ? 'day' : `${growth.days} days`}.
        </p>
      )}
      <WordList
        title="Coming up in WaniKani"
        empty="Every frequent WaniKani word in this list is known."
        rows={coverage.comingUp}
        showLevel
      />
      <WordList
        title="Not in WaniKani"
        empty="Every frequent word in this list is in WaniKani."
        rows={coverage.notInWaniKani}
      />
    </>
  );
}

function WordList({
  title,
  empty,
  rows,
  showLevel,
}: {
  title: string;
  empty: string;
  rows: WordRow[];
  showLevel?: boolean;
}) {
  const [size, setSize] = useState(PAGE_SIZES[0]!);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  // Rows shrink when the known stage changes; stay on a page that exists.
  const at = Math.min(page, pages - 1);
  const id = useId();
  return (
    <Card title={title} aside={`${plural(rows.length, 'word')}, most frequent first`}>
      {rows.length === 0 ? (
        <p className={styles.note}>{empty}</p>
      ) : (
        <ol className={styles.words} aria-label={`${title}, page ${at + 1} of ${pages}`}>
          {rows.slice(at * size, (at + 1) * size).map((w) => (
            <li key={w.rank + w.word} className={styles.word}>
              <span lang="ja" className={styles.wordChars}>
                {w.word}
              </span>
              <span lang="ja" className={styles.reading}>
                {w.reading || '\u00a0'}
              </span>
              <span className={styles.wordMeta}>
                <span>
                  <span className="visually-hidden">Rank </span>
                  <span aria-hidden="true">#</span>
                  {num(w.rank)}
                </span>
                {showLevel && w.level && <span>Level {w.level}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {rows.length > PAGE_SIZES[0]! && (
        <div className={styles.pager}>
          <label htmlFor={id}>Per page</label>
          <select
            id={id}
            value={size}
            onChange={(e) => {
              const next = Number(e.target.value);
              // Keep the first word on screen in view.
              setPage(Math.floor((at * size) / next));
              setSize(next);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <span className={styles.pageOf} aria-live="polite">
            Page {at + 1} of {pages}
          </span>
          {/* aria-disabled, not disabled, so focus stays on the button at either end. */}
          <Button small aria-disabled={at === 0} onClick={() => at > 0 && setPage(at - 1)}>
            Previous
          </Button>
          <Button
            small
            aria-disabled={at >= pages - 1}
            onClick={() => at < pages - 1 && setPage(at + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
