import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppMode, useDb } from '../../db/useAppMode';
import { useNow } from '../../hooks/useNow';
import { GoalLevelField, InstallControl, WakingHoursFields } from '../settings/fields';
import { useGlance, type GlanceRow } from './useGlance';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const db = useDb();
  const sample = useAppMode() === 'sample';
  const navigate = useNavigate();
  const glance = useGlance(useNow());
  useEffect(() => {
    void db.meta.put({ key: 'onboardingSeen', value: true });
  }, [db]);
  return (
    <>
      <ScreenHeader title="Welcome" />
      <Onboarding glance={glance} sample={sample} onDone={() => void navigate({ to: '/' })} />
    </>
  );
}

const STEPS = ['What you get', 'Open it once a day', 'Make it one tap'];

export function Onboarding({
  glance,
  sample = false,
  onDone,
}: {
  glance: GlanceRow[] | undefined;
  sample?: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <ol className={styles.progress} aria-label="Introduction">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined} data-done={i <= step}>
              <span className="visually-hidden">{label}</span>
            </li>
          ))}
        </ol>
        <span className={styles.count}>
          Step {step + 1} of {STEPS.length}
        </span>
        <Button small onClick={onDone} className={styles.skip}>
          Skip
        </Button>
      </div>
      {step === 0 && <StepGlance glance={glance} sample={sample} />}
      {step === 1 && <StepDaily />}
      {step === 2 && <StepInstall />}
      <div className={styles.actions}>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {last ? (
          <Button variant="primary" onClick={onDone}>
            Go to Today
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        )}
      </div>
    </Card>
  );
}

function StepGlance({ glance, sample }: { glance: GlanceRow[] | undefined; sample: boolean }) {
  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>Your WaniKani, at a glance</h2>
      {glance ? (
        <dl className={styles.glance}>
          {glance.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>
                <span className={styles.value}>{r.value}</span>
                <span className={styles.note}>{r.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.small}>
          Next level-up, workload and finish date appear here after the first sync.
        </p>
      )}
      {sample && glance && <p className={styles.small}>These numbers come from sample data.</p>}
    </section>
  );
}

const MARKERS: Partial<Record<number, string>> = { 7: 'Recent accuracy', 30: 'Monthly trends' };

function StepDaily() {
  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>Open WaniStats once a day</h2>
      <p>
        WaniKani&apos;s API keeps your lifetime totals but not your day-by-day history. Each day you
        open WaniStats, it saves a snapshot on this device. Those snapshots become your recent
        accuracy, your workload trend and how fast you&apos;re learning new kanji.
      </p>
      <figure className={styles.paper}>
        <div
          className={styles.squares}
          role="img"
          aria-label="30 days of snapshots. Today fills the first. Recent accuracy appears at day 7, monthly trends at day 30."
        >
          {Array.from({ length: 30 }, (_, i) => (
            <span
              key={i}
              className={styles.square}
              data-today={i === 0}
              data-marker={MARKERS[i + 1] !== undefined}
            >
              {MARKERS[i + 1] && i + 1}
            </span>
          ))}
        </div>
        <figcaption className={styles.markers}>
          {Object.entries(MARKERS).map(([day, label]) => (
            <span key={day}>
              <span className={styles.markerDay}>Day {day}</span> {label}
            </span>
          ))}
        </figcaption>
      </figure>
      <p>
        Level history, projections and the review timeline work from today. Missed days merge into
        the next one, so trends get coarser, not wrong.
      </p>
      <p className={styles.small}>
        Snapshots stay in this browser. Export them from Settings to keep a backup.
      </p>
    </section>
  );
}

function StepInstall() {
  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>Keep it one tap away</h2>
      <InstallControl />
      <p className={styles.small}>
        On Android and desktop Chrome, an installed WaniStats can sometimes take the snapshot for
        you in the background. Don&apos;t count on it; opening it daily is what works everywhere.
      </p>
      <div>
        <GoalLevelField />
        <WakingHoursFields />
      </div>
      <p className={styles.small}>
        Kanji and word coverage need a small optional download. You&apos;ll be asked first, with
        the size.
      </p>
    </section>
  );
}
