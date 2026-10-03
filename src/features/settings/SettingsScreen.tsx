import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { User } from '../../api/types';
import { Button, buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { LogoutSheet } from '../../components/LogoutSheet';
import { RefreshData } from '../../components/RefreshData';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Sheet } from '../../components/Sheet';
import {
  useHistoryRange,
  useLastSyncAt,
  useMaskedToken,
  useOtherAccountsWithHistory,
  useUser,
} from '../../db/hooks';
import { usePref, type Prefs } from '../../db/prefs';
import { useAccountDb, useAppMode, useDb } from '../../db/useAppMode';
import { otherAccount, type HistoryFile } from '../../domain/historyFile';
import { formatLocalDate, formatSyncTime, plural } from '../../format';
import { useClock } from '../../hooks/useClock';
import { useInstalledPacks, useManifest } from '../../packs/hooks';
import { deletePack, formatBytes, hasUpdate, packsDb, sizeOnDevice } from '../../packs/packs';
import {
  deleteHistory,
  deleteLocalData,
  exportHistory,
  importHistory,
  readHistoryFile,
} from '../../sync/session';
import { clearCachedData } from '../../sync/sync';
import { useSync, waitForSync } from '../../sync/useSync';
import { DownloadSheet } from '../packs/DownloadSheet';
import {
  Field,
  GoalLevelField,
  InstallControl,
  LessonTimeField,
  StepperField,
  WakingHoursFields,
} from './fields';
import fieldStyles from './fields.module.css';
import styles from './SettingsScreen.module.css';

const SUBSCRIPTION: Record<User['subscription']['type'], string> = {
  free: 'Free',
  recurring: 'Subscription',
  lifetime: 'Lifetime',
  unknown: 'Unknown',
};

/** Anchored so links like /settings#history land on the section. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className={styles.anchor}>
      <Card title={title}>{children}</Card>
    </div>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.rows}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Keeps a /settings#section link on its section while cards above it load and change height,
 * until the user scrolls or a few seconds pass. Clears the sticky sample strip.
 */
function useHashScroll(box: RefObject<HTMLElement | null>) {
  const hash = useLocation({ select: (l) => l.hash.replace(/^#/, '') });
  useEffect(() => {
    const el = box.current;
    if (!hash || !el) return;
    const align = () => {
      const target = document.getElementById(hash);
      if (!target) return;
      const strip = document.querySelector<HTMLElement>('[data-sticky-top]');
      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - (strip?.offsetHeight ?? 0) - 16, behavior: 'instant' });
    };
    const ro = new ResizeObserver(align);
    ro.observe(el);
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    const stop = () => {
      ro.disconnect();
      clearTimeout(timer);
      events.forEach((e) => removeEventListener(e, stop));
    };
    const timer = setTimeout(stop, 3000);
    events.forEach((e) => addEventListener(e, stop, { passive: true }));
    return stop;
  }, [hash, box]);
}

export function SettingsScreen() {
  const live = useAppMode() === 'live';
  const sections = useRef<HTMLDivElement>(null);
  useHashScroll(sections);
  return (
    <>
      <ScreenHeader title="Settings" />
      <div ref={sections} className={styles.sections}>
        <Section id="account" title="Account">
          {live ? (
            <LiveAccount />
          ) : (
            <>
              <p>You&apos;re viewing sample data</p>
              <Link to="/login" className={buttonClass('primary')}>
                Log in with WaniKani
              </Link>
            </>
          )}
        </Section>
        {live && <SyncSection />}
        {live && <HistorySection />}
        <PacksSection />
        <PreferencesSection />
        <AppSection />
        <LocalDataSection />
        <AboutSection />
      </div>
    </>
  );
}

const andList = new Intl.ListFormat('en', { type: 'conjunction' });

function LiveAccount() {
  const user = useUser();
  const token = useMaskedToken();
  const others = useOtherAccountsWithHistory(user?.id);
  const [logoutOpen, setLogoutOpen] = useState(false);
  return (
    <>
      {user && (
        <Rows
          rows={[
            ['Username', user.username],
            ['Level', user.level],
            ['Subscription', SUBSCRIPTION[user.subscription.type]],
            ['Levels available', `Up to ${user.subscription.max_level_granted}`],
            ['Token', <span className={styles.token}>{token}</span>],
          ]}
        />
      )}
      <p className={styles.muted}>
        Your token stays in this browser and is only ever sent to api.wanikani.com. WaniStats only
        needs read access, so a read-only token is enough.
      </p>
      {others && others.length > 0 && (
        <p className={styles.muted}>
          History for {andList.format(others)} is also stored in this browser.
        </p>
      )}
      <div className={styles.actions}>
        <Link to="/login" className={buttonClass('secondary')}>
          Replace token
        </Link>
        <Button onClick={() => setLogoutOpen(true)}>Log out</Button>
      </div>
      <LogoutSheet open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}

function SyncSection() {
  const db = useDb();
  const lastSync = useLastSyncAt();
  const clock = useClock();
  const { sync, running } = useSync();
  const resync = async () => {
    await waitForSync();
    await clearCachedData(db);
    sync();
  };
  return (
    <Section id="sync" title="Sync">
      <Rows
        rows={[['Last sync', lastSync != null ? formatSyncTime(lastSync, clock) : 'Not yet']]}
      />
      <RefreshData />
      <Button disabled={running} onClick={() => void resync()}>
        Clear cached data and resync
      </Button>
      <p className={styles.muted}>
        Synced data and history stay in this browser. Clearing cached data keeps your history and
        preferences.
      </p>
    </Section>
  );
}

function HistorySection() {
  const history = useHistoryRange();
  const user = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState<HistoryFile | null>(null);
  const days = history?.days ?? 0;
  const lastTaken = history?.lastTakenAt;
  const clock = useClock();
  const foreign = pending && user ? otherAccount(pending, user.id) : undefined;

  // readHistoryFile throws plain Errors with user-facing copy; anything else is IndexedDB.
  const fail = (e: unknown) =>
    setMessage(
      e instanceof Error && e.name === 'Error'
        ? e.message
        : "Couldn't save the imported history. Try again.",
    );
  const merge = async (file: HistoryFile) => {
    setPending(null);
    try {
      const { days } = await importHistory(file);
      setMessage(`Imported. ${plural(days, 'day')} recorded.`);
    } catch (e) {
      fail(e);
    }
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = readHistoryFile(await file.text());
      if (user && otherAccount(parsed, user.id)) setPending(parsed);
      else await merge(parsed);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Section id="history" title="History">
      <p className={styles.muted}>
        WaniKani only keeps lifetime totals, so WaniStats saves a snapshot each day you open it.
        Snapshots live only in this browser. Export them to keep a backup.
      </p>
      <Rows
        rows={[
          ['Days recorded', days],
          ['First snapshot', history?.first ? formatLocalDate(history.first) : 'None yet'],
          ['Last snapshot', lastTaken ? formatSyncTime(Date.parse(lastTaken), clock) : 'None yet'],
        ]}
      />
      <div className={styles.actions}>
        <Button onClick={() => void exportHistory()}>Export history</Button>
        <Button onClick={() => fileRef.current?.click()}>Import history</Button>
        <Button disabled={days === 0} onClick={() => setConfirmDelete(true)}>
          Delete history
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="History file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <p role="status" className={styles.muted}>
        {message}
      </p>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete history">
        <div className={styles.sheet}>
          <p>
            Delete {plural(days, 'day')} of history from this browser? This can&apos;t be undone.
            Export your history first if you want to keep it.
          </p>
          <Button onClick={() => void exportHistory()}>Export history</Button>
          <Button
            variant="primary"
            onClick={() =>
              void deleteHistory().then(() => {
                setConfirmDelete(false);
                setMessage('History deleted.');
              })
            }
          >
            Delete history
          </Button>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
        </div>
      </Sheet>
      <Sheet open={!!foreign} onClose={() => setPending(null)} title="Import history">
        <div className={styles.sheet}>
          <p>
            This file holds history for {foreign?.username}. Import it into {user?.username} anyway?
          </p>
          <Button variant="primary" onClick={() => pending && void merge(pending)}>
            Import
          </Button>
          <Button onClick={() => setPending(null)}>Cancel</Button>
        </div>
      </Sheet>
    </Section>
  );
}

/** Manifest versions are build dates, YYYYMMDD. */
const versionDate = (v: string) =>
  formatLocalDate(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`);

function PacksSection() {
  const manifest = useManifest();
  const installed = useInstalledPacks();
  const [sheet, setSheet] = useState<string[] | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  // Serialising a pack is not free; only redo it when the installed rows change.
  const sizes = useMemo(
    () => new Map((installed ?? []).map((r) => [r.id, sizeOnDevice(r)])),
    [installed],
  );
  const entries = manifest.data?.packs ?? [];
  const rows = new Map((installed ?? []).map((r) => [r.id, r]));
  const orphans = (installed ?? []).filter((r) => !entries.some((e) => e.id === r.id));
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);

  const pack = (id: string, label: string, detail: string, actions: ReactNode) => (
    <li key={id} className={styles.pack}>
      <span className={styles.packText}>
        <span className={styles.packName}>{label}</span>
        <span className={styles.muted}>{detail}</span>
      </span>
      <span className={styles.actions}>{actions}</span>
    </li>
  );
  const remove = (id: string, label: string) => (
    <Button small aria-label={`Delete ${label}`} onClick={() => void deletePack(id)}>
      Delete
    </Button>
  );

  return (
    <Section id="data-packs" title="Data packs">
      <p className={styles.muted}>
        Coverage data is an optional download that stays on this device. Nothing downloads until you
        press Download.
      </p>
      {manifest.isError && (
        <p role="alert" className={styles.error}>
          Couldn&apos;t load the list of data packs. Check your connection and try again.
        </p>
      )}
      <ul className={styles.packs}>
        {entries.map((e) => {
          const row = rows.get(e.id);
          return pack(
            e.id,
            e.label,
            row
              ? `Version ${versionDate(row.version)}, ${formatBytes(sizes.get(e.id) ?? 0)} on device`
              : `Not downloaded, ${formatBytes(e.bytes)}`,
            <>
              {!row && (
                <Button small aria-label={`Download ${e.label}`} onClick={() => setSheet([e.id])}>
                  Download
                </Button>
              )}
              {hasUpdate(e, row) && (
                <Button
                  small
                  aria-label={`Update ${e.label}, ${formatBytes(e.bytes)}`}
                  onClick={() => setSheet([e.id])}
                >
                  Update
                </Button>
              )}
              {row && remove(e.id, e.label)}
            </>,
          );
        })}
        {orphans.map((r) =>
          pack(
            r.id,
            r.id,
            `${formatBytes(sizes.get(r.id) ?? 0)} on device, no longer offered`,
            remove(r.id, r.id),
          ),
        )}
      </ul>
      {(installed?.length ?? 0) > 0 && (
        <div className={styles.actions}>
          <Button onClick={() => setConfirmDeleteAll(true)}>Delete all data packs</Button>
        </div>
      )}
      <Rows rows={[['Storage used', formatBytes(total)]]} />
      <Sheet
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title="Delete all data packs"
      >
        <div className={styles.sheet}>
          <p>
            Delete all downloaded coverage data from this browser? You can download it again later.
          </p>
          <Button
            variant="primary"
            onClick={() => void packsDb.packs.clear().then(() => setConfirmDeleteAll(false))}
          >
            Delete all data packs
          </Button>
          <Button onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
        </div>
      </Sheet>
      <DownloadSheet open={sheet !== null} onClose={() => setSheet(null)} preselect={sheet ?? []} />
    </Section>
  );
}

const THEMES: { value: Prefs['theme']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const CLOCKS: { value: Prefs['clock']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
];
const SPLITS: { value: Prefs['timelineSplit']; label: string }[] = [
  { value: 'stage', label: 'SRS stage' },
  { value: 'type', label: 'Item type' },
];

function PreferencesSection() {
  const [goalDate, setGoalDate] = usePref('goalDate');
  const [band, setBand] = usePref('band');
  const [lessonsPerDay, setLessonsPerDay] = usePref('lessonsPerDay');
  const [theme, setTheme] = usePref('theme');
  const [clockPref, setClock] = usePref('clock');
  const [split, setSplit] = usePref('timelineSplit');
  const [overrides, setOverrides] = usePref('levelOverrides');
  const overrideCount = Object.keys(overrides).length;

  return (
    <Section id="preferences" title="Preferences">
      <div>
        <GoalLevelField />
        <Field label="Goal date">
          {(id) => (
            <input
              id={id}
              type="date"
              className={fieldStyles.control}
              value={goalDate ?? ''}
              onChange={(e) => void setGoalDate(e.target.value || null)}
            />
          )}
        </Field>
        <StepperField
          label="Comfortable load, from"
          value={band.min}
          min={0}
          max={1000}
          step={10}
          onChange={(min) => void setBand({ ...band, min })}
        />
        <StepperField
          label="Comfortable load, to"
          value={band.max}
          min={0}
          max={1000}
          step={10}
          onChange={(max) => void setBand({ ...band, max })}
        />
        <WakingHoursFields />
        <LessonTimeField />
        <StepperField
          label="Lessons a day"
          value={lessonsPerDay}
          min={0}
          max={200}
          onChange={(v) => void setLessonsPerDay(v)}
        />
        <div className={fieldStyles.field}>
          <span>Theme</span>
          <SegmentedControl
            label="Theme"
            options={THEMES}
            value={theme}
            onChange={(v) => void setTheme(v)}
          />
        </div>
        <div className={fieldStyles.field}>
          <span>Clock</span>
          <SegmentedControl
            label="Clock"
            options={CLOCKS}
            value={clockPref}
            onChange={(v) => void setClock(v)}
          />
        </div>
        <div className={fieldStyles.field}>
          <span>Timeline split</span>
          <SegmentedControl
            label="Timeline split"
            options={SPLITS}
            value={split}
            onChange={(v) => void setSplit(v)}
          />
        </div>
        <WordMediaField />
      </div>
      <div className={styles.actions}>
        <Button disabled={overrideCount === 0} onClick={() => void setOverrides({})}>
          Reset level exclusions
        </Button>
      </div>
      <p className={styles.muted}>
        {overrideCount === 0
          ? 'Pace includes or leaves out each level automatically.'
          : `${plural(overrideCount, 'level')} set by hand on Pace. Resetting returns them to automatic.`}
      </p>
    </Section>
  );
}

/** The word frequency list Coverage uses in Words mode; the same choice as its list picker. */
function WordMediaField() {
  const [media, setMedia] = usePref('wordMedia');
  const options = (useManifest().data?.packs ?? []).filter((p) => p.id.startsWith('words-'));
  const installed = new Set(useInstalledPacks()?.map((r) => r.id));
  if (!options.length) return null;
  return (
    <fieldset className={styles.media}>
      <legend>Word coverage list</legend>
      {options.map((p) => {
        const key = p.id.slice('words-'.length);
        return (
          <label key={p.id} className={styles.check}>
            <input
              type="radio"
              name="word-media"
              checked={media[0] === key}
              onChange={() => void setMedia([key])}
            />
            {p.label}
            {!installed.has(p.id) && ', not downloaded'}
          </label>
        );
      })}
    </fieldset>
  );
}

function AppSection() {
  const [update, setUpdate] = useState('');
  const check = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) {
      setUpdate('Updates are checked when WaniStats runs from wanistats.com.');
      return;
    }
    setUpdate('Checking for updates');
    try {
      await reg.update();
      // A found update installs in the background; the "A new version is ready." toast follows.
      setUpdate(
        reg.installing || reg.waiting
          ? 'A new version is downloading.'
          : 'You have the latest version.',
      );
    } catch {
      setUpdate("Can't reach WaniStats. Check your connection and try again.");
    }
  };
  return (
    <Section id="app" title="App">
      <InstallControl />
      <Rows
        rows={[
          ['Version', __APP_VERSION__],
          ['Built', formatLocalDate(__BUILD_DATE__)],
        ]}
      />
      <div className={styles.actions}>
        <Button onClick={() => void check()}>Check for updates</Button>
        <Link to="/welcome" className={buttonClass('secondary')}>
          Show the introduction again
        </Link>
      </div>
      <p role="status" className={styles.muted}>
        {update}
      </p>
    </Section>
  );
}

function LocalDataSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const account = useAccountDb();
  // The last account's history, which stays after logout.
  const days = useLiveQuery(() => account?.snapshots.count() ?? 0, [account]) ?? 0;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await deleteLocalData(queryClient);
      setOpen(false);
      await navigate({ to: '/' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section id="local-data" title="Local data">
      <p className={styles.muted}>
        Logging out keeps your synced data and history. Deleting local data removes everything
        WaniStats stores in this browser.
      </p>
      <div className={styles.actions}>
        <Button onClick={() => setOpen(true)}>Delete local data</Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Delete local data">
        <div className={styles.sheet}>
          <p>
            Delete all WaniStats data from this browser? This removes your token, synced data,
            history and preferences for every account used in this browser, and data packs. History
            can&apos;t be rebuilt from WaniKani, so export it first if you want to keep it.
          </p>
          {days > 0 && <Button onClick={() => void exportHistory()}>Export history</Button>}
          <Button variant="primary" disabled={busy} onClick={() => void remove()}>
            Delete local data
          </Button>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Sheet>
    </Section>
  );
}

function AboutSection() {
  return (
    <Section id="about" title="About">
      <p>
        WaniStats is free and has no ads. It reads your WaniKani data through the WaniKani API using
        a token you provide and stores it only on this device.
      </p>
      <Link to="/about">More about WaniStats</Link>
    </Section>
  );
}
