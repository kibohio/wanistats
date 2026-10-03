import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import type { User } from '../../api/types';
import { Button, buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { LogoutSheet } from '../../components/LogoutSheet';
import { RefreshData } from '../../components/RefreshData';
import { ScreenHeader } from '../../components/ScreenHeader';
import { COMPANY, JITEN_URL, SOURCE_URL } from '../../config';
import { useHistoryRange, useLastSyncAt, useMaskedToken, useUser } from '../../db/hooks';
import { liveDb, useAppMode } from '../../db/useAppMode';
import { formatLocalDate, formatSyncTime } from '../../format';
import { exportHistory } from '../../sync/session';
import { clearCachedData } from '../../sync/sync';
import { useSync, waitForSync } from '../../sync/useSync';
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

export function SettingsScreen() {
  const live = useAppMode() === 'live';
  return (
    <>
      <ScreenHeader title="Settings" />
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
      <Section id="data-packs" title="Data packs">
        <p className={styles.muted}>Coverage data packs you download appear here.</p>
      </Section>
      <Section id="preferences" title="Preferences">
        <p className={styles.muted}>Goal, workload band, waking hours and theme appear here.</p>
      </Section>
      <Section id="app" title="App">
        <Rows
          rows={[
            ['Version', __APP_VERSION__],
            ['Built', formatLocalDate(__BUILD_DATE__)],
          ]}
        />
      </Section>
      <Section id="about" title="About">
        <p>
          WaniStats shows when you level up, how heavy your reviews are and when you finish, from
          your WaniKani data. Everything runs in this browser.
        </p>
        <ul className={styles.list}>
          <li>
            Word and kanji frequency from <a href={JITEN_URL}>Jiten</a>, CC BY-SA 4.0
          </li>
          <li>Kanji grades and stroke counts from KANJIDIC2 (EDRDG), CC BY-SA 4.0</li>
          <li>JLPT levels from unofficial lists by Jonathan Waller, CC BY</li>
        </ul>
        <p>Built and maintained by {COMPANY}</p>
        <a href={SOURCE_URL}>Source on GitHub</a>
        <p className={styles.muted}>Not affiliated with WaniKani or Tofugu.</p>
      </Section>
    </>
  );
}

function LiveAccount() {
  const user = useUser();
  const token = useMaskedToken();
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
  const lastSync = useLastSyncAt();
  const { sync, running } = useSync();
  const resync = async () => {
    await waitForSync();
    await clearCachedData(liveDb);
    sync();
  };
  return (
    <Section id="sync" title="Sync">
      <Rows rows={[['Last sync', lastSync != null ? formatSyncTime(lastSync) : 'Not yet']]} />
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
  const date = (d?: string) => (d ? formatLocalDate(d) : 'None yet');
  return (
    <Section id="history" title="History">
      <Rows
        rows={[
          ['Days recorded', history?.days ?? 0],
          ['First snapshot', date(history?.first)],
          ['Last snapshot', date(history?.last)],
        ]}
      />
      <div className={styles.actions}>
        <Button onClick={() => void exportHistory()}>Export history</Button>
        {/* ponytail: import and delete arrive with the history file work */}
        <Button disabled>Import history</Button>
        <Button disabled>Delete history</Button>
      </div>
    </Section>
  );
}
