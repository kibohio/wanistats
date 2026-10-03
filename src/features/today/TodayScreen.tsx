import { useState } from 'react';
import { buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { CloseIcon, ExternalIcon } from '../../components/icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useLastSyncAt } from '../../db/hooks';
import { formatDate, formatSyncTime } from '../../format';
import { Explain } from './Explain';
import { FinishCard } from './FinishCard';
import { fullDay, plural, sinceDay } from './format';
import { LevelUpCard, LevelUpCardDesktop } from './LevelUpCard';
import { AccuracyCard, CoverageCard, LeechesCard } from './SummaryCards';
import styles from './Today.module.css';
import { useToday, type TodayData } from './useToday';
import { WorkloadCard } from './WorkloadCard';
import { TimelineCard } from '../timeline/TimelineChart';
import { useIsDesktop } from '../timeline/useTimelineData';

export function TodayScreen() {
  const d = useToday();
  const desktop = useIsDesktop();
  if (!d) {
    return (
      <>
        <ScreenHeader title="Today" />
        <Card title="Next level-up">
          <p className={styles.note}>Loading data.</p>
        </Card>
      </>
    );
  }
  return desktop ? <Desktop d={d} /> : <Phone d={d} />;
}

function Phone({ d }: { d: TodayData }) {
  const lastSync = useLastSyncAt();
  return (
    <>
      <ScreenHeader
        aside={!d.sample && lastSync != null ? `Synced ${formatSyncTime(lastSync)}` : undefined}
      >
        <LevelLead d={d} />
      </ScreenHeader>
      <Notices d={d} />
      <LevelUpCard d={d} />
      <WorkloadCard d={d} />
      <FinishCard d={d} />
    </>
  );
}

function Desktop({ d }: { d: TodayData }) {
  return (
    <>
      <ScreenHeader
        aside={
          <a
            href="https://www.wanikani.com/"
            target="_blank"
            rel="noreferrer"
            className={buttonClass('primary')}
          >
            {d.availableNow > 0
              ? `Do ${plural(d.availableNow, 'review')} on WaniKani`
              : 'Open WaniKani'}
            <ExternalIcon size={14} strokeWidth={2} />
          </a>
        }
      >
        <LevelLead d={d} desktop />
      </ScreenHeader>
      <Notices d={d} />
      <div className={styles.row}>
        <LevelUpCardDesktop d={d} />
        <WorkloadCard d={d} desktop />
        <FinishCard d={d} desktop />
      </div>
      <TimelineCard />
      <div className={styles.row}>
        <CoverageCard d={d} />
        <LeechesCard d={d} />
        <AccuracyCard d={d} />
      </div>
    </>
  );
}

/** Level numeral with a small "Level" label, the level day and, on desktop, today's date. */
function LevelLead({ d, desktop }: { d: TodayData; desktop?: boolean }) {
  return (
    <div className={styles.lead}>
      <h1 className={styles.levelHeading}>
        <span className={styles.numeral} aria-hidden="true">
          {d.user.level}
        </span>
        <span className="visually-hidden">Level {d.user.level}</span>
      </h1>
      <div className={styles.levelText}>
        <span className={styles.levelLabel} aria-hidden="true">
          Level
        </span>
        <span>
          {d.levelDay !== null && (
            <DayExplain d={d}>
              <span className={styles.day}>Day {d.levelDay}</span>
            </DayExplain>
          )}
          {desktop && (
            <span className={styles.today}>
              {d.levelDay !== null && ', '}
              {fullDay(d.now)}
            </span>
          )}
        </span>
      </div>
      {d.sample && <Chip>Sample</Chip>}
    </div>
  );
}

function DayExplain({ d, children }: { d: TodayData; children: React.ReactNode }) {
  return (
    <Explain
      title={`Level ${d.user.level}`}
      explain={
        <p>
          Level {d.user.level} unlocked on {d.levelStartAt !== null && formatDate(d.levelStartAt)}.
          Day 1 is the first 24 hours after that.
          {d.vacation && ' The count is frozen while vacation mode is on.'}
        </p>
      }
    >
      {children}
    </Explain>
  );
}

const GAP_KEY = 'wanistats:gapDismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(GAP_KEY);
  } catch {
    return null;
  }
}

function Notices({ d }: { d: TodayData }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const capped = d.levelUp.status === 'capped' || !!d.finish?.capped;
  const gap = d.gapSince && d.gapSince !== dismissed ? d.gapSince : null;
  if (!d.vacation && !capped && !gap) return null;
  return (
    <div className={styles.notices}>
      {d.vacation && (
        <p className={styles.notice}>
          <span>
            <strong>Vacation mode is on.</strong> Level days and projections are frozen until it
            ends.
          </span>
        </p>
      )}
      {capped && (
        <p className={styles.notice}>
          Projections stop at level {d.maxLevel}, the highest this subscription grants.
        </p>
      )}
      {gap && (
        <p className={styles.notice}>
          <span>First snapshot since {sinceDay(gap, d.now)}. The days in between are merged.</span>
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss"
            onClick={() => {
              try {
                localStorage.setItem(GAP_KEY, gap);
              } catch {
                // Storage blocked: dismiss for this visit only.
              }
              setDismissed(gap);
            }}
          >
            <CloseIcon size={18} />
          </button>
        </p>
      )}
    </div>
  );
}
