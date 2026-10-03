import { activeDb } from '../../db/useAppMode';
import { useNavigate } from '@tanstack/react-router';
import { useId, useState, type FormEvent } from 'react';
import { getUser, WkError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ExternalIcon } from '../../components/icons';
import { syncErrorCopy } from '../../components/RefreshData';
import { ScreenHeader } from '../../components/ScreenHeader';
import { WK_TOKEN_URL } from '../../config';
import { saveLogin } from '../../sync/session';
import { SYNC_STEPS, type SyncProgress } from '../../sync/sync';
import { useSync } from '../../sync/useSync';
import styles from './LoginScreen.module.css';

type Phase = 'form' | 'checking' | 'syncing';

function tokenErrorCopy(e: unknown): string {
  if (e instanceof WkError && e.kind === 'unauthorized') {
    return 'WaniKani rejected that token. Check that you copied all of it.';
  }
  return syncErrorCopy(e instanceof WkError ? e : new WkError('network'));
}

export function LoginScreen() {
  const inputId = useId();
  const errorId = useId();
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const { syncAsync, progress } = useSync();
  const navigate = useNavigate();

  async function connect(e: FormEvent) {
    e.preventDefault();
    const value = token.trim();
    if (!value) return;
    setError('');
    setPhase('checking');
    try {
      // 429 is waited out and retried inside the client.
      const report = await getUser(value);
      await saveLogin(value, report.data);
      setPhase('syncing');
      await syncAsync();
      // Onboarding shows once per account; logging back in goes straight to Today.
      const seen = await (await activeDb())?.meta.get('onboardingSeen');
      await navigate({ to: seen?.value ? '/' : '/welcome' });
    } catch (err) {
      setPhase('form');
      setError(tokenErrorCopy(err));
    }
  }

  return (
    <>
      <ScreenHeader title="Log in" />
      <Card className={styles.card}>
        <h2 className={styles.heading}>Connect your WaniKani account</h2>
        <p>
          Paste a personal access token. WaniStats only needs read access. Your token stays in this
          browser and is only ever sent to api.wanikani.com.
        </p>
        <a href={WK_TOKEN_URL} target="_blank" rel="noreferrer" className={styles.external}>
          Create a token on WaniKani
          <ExternalIcon size={16} />
        </a>
        {phase === 'syncing' ? (
          <SyncSteps progress={progress} />
        ) : (
          <form className={styles.form} onSubmit={(e) => void connect(e)}>
            <label htmlFor={inputId} className={styles.label}>
              Personal access token
            </label>
            <div className={styles.row}>
              <input
                id={inputId}
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className={styles.input}
              />
              <Button aria-pressed={show} onClick={() => setShow(!show)}>
                {show ? 'Hide' : 'Show'}
              </Button>
            </div>
            {error && (
              <p id={errorId} role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={phase === 'checking' || !token.trim()}
            >
              {phase === 'checking' ? 'Connecting' : 'Connect'}
            </Button>
          </form>
        )}
      </Card>
    </>
  );
}

function SyncSteps({ progress }: { progress: SyncProgress | null }) {
  const current = progress?.step ?? 0;
  return (
    <ol className={styles.steps} aria-label="First sync">
      {SYNC_STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending';
        return (
          <li
            key={label}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.mark} aria-hidden="true" />
            {label}
            {state === 'done' && <span className="visually-hidden">, done</span>}
            {state === 'current' && progress && progress.total > 0 && (
              <span className={styles.count}>
                {progress.loaded.toLocaleString()} of {progress.total.toLocaleString()}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
