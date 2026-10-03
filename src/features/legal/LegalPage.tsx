import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { HOST_PRIVACY_URL, PRIVACY_CONTACT, SOURCE_URL } from '../../config';
import styles from './LegalPage.module.css';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <ScreenHeader title={title} />
      <div className={styles.page}>
        <Card>
          {children}
          <p className={styles.updated}>Last updated 3 October 2026</p>
        </Card>
      </div>
    </>
  );
}

const contact = <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>;

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>WaniStats has no server, no accounts, no analytics, no cookies and no tracking.</p>
      <p>
        Your WaniKani API token and all synced data, history snapshots and data packs are stored
        only in this browser, in IndexedDB.
      </p>
      <p>Your token is only ever sent to api.wanikani.com. Nothing is sent to Kiboh Inc.</p>
      <p>Data packs are downloaded from wanistats.com only when you choose to download them.</p>
      <p>
        The site is served by a static host, Cloudflare Pages, which keeps standard request logs
        such as IP address and browser type. See{' '}
        <a href={HOST_PRIVACY_URL}>Cloudflare&apos;s privacy policy</a>.
      </p>
      <p>
        Logging out removes your token from this browser. Synced data, history and data packs stay,
        kept separately for each WaniKani account, so nothing is lost when you log in again.{' '}
        <Link to="/settings" hash="local-data">
          Settings, Delete local data
        </Link>{' '}
        removes everything from this browser and lets you export your history first.
      </p>
      <p>
        For questions or removal requests, email {contact}. Because nothing is stored on a server,
        there is no server-side data to remove.
      </p>
      <p>
        WaniKani&apos;s own handling of your data is covered by{' '}
        <a href="https://www.wanikani.com/privacy">WaniKani&apos;s privacy policy</a>.
      </p>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>WaniStats is a free, independent tool provided as is, without warranty of any kind.</p>
      <p>
        Projections, forecasts, coverage figures and estimates are calculations, not guarantees.
        WaniKani&apos;s data and rules can change.
      </p>
      <p>
        You need your own WaniKani account and API token. Your use of WaniKani is governed by{' '}
        <a href="https://www.wanikani.com/terms">WaniKani&apos;s terms</a>.
      </p>
      <p>
        WaniStats is not affiliated with or endorsed by WaniKani or Tofugu, LLC. WaniKani is a
        trademark of Tofugu, LLC. WaniKani content belongs to Tofugu, LLC.
      </p>
      <p>
        Reference data is licensed CC BY-SA 4.0 as credited in{' '}
        <Link to="/settings" hash="about">
          Settings, About
        </Link>
        . The source code is licensed under the{' '}
        <a href={`${SOURCE_URL}/blob/main/LICENSE`}>MIT licence</a>, as stated in the repository.
      </p>
      <p>Kiboh Inc. may change or discontinue the site at any time.</p>
      <p>For questions, email {contact}.</p>
    </LegalPage>
  );
}
