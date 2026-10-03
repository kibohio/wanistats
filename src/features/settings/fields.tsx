import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { usePref } from '../../db/prefs';
import { useInstall } from '../../hooks/useInstall';
import styles from './fields.module.css';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const LEVELS = Array.from({ length: 59 }, (_, i) => i + 2);

export function formatHour(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          className={styles.control}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export const hourOptions = HOURS.map((h) => ({ value: h, label: formatHour(h) }));

/** Keeps its own text so a half-typed number isn't overwritten by the stored value. */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className={styles.control}
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
          }}
        />
      )}
    </Field>
  );
}

export function GoalLevelField() {
  const [goal, setGoal] = usePref('goalLevel');
  return (
    <SelectField
      label="Goal level"
      value={goal}
      options={LEVELS.map((l) => ({ value: l, label: `Level ${l}` }))}
      onChange={(v) => void setGoal(v)}
    />
  );
}

export function WakingHoursFields() {
  const [wake, setWake] = usePref('wakeHour');
  const [sleep, setSleep] = usePref('sleepHour');
  return (
    <>
      <SelectField
        label="Wake up"
        value={wake}
        options={hourOptions}
        onChange={(v) => void setWake(v)}
      />
      <SelectField
        label="Go to sleep"
        value={sleep}
        options={hourOptions}
        onChange={(v) => void setSleep(v)}
      />
    </>
  );
}

function ShareIcon() {
  return (
    <svg
      className={styles.share}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Share"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

/** Install button, the iOS Safari steps, or a note that it's installed. */
export function InstallControl() {
  const { installed, canPrompt, ios, prompt } = useInstall();
  if (installed) return <p className={styles.note}>WaniStats is installed on this device.</p>;
  if (canPrompt) {
    return (
      <Button variant="primary" onClick={() => void prompt()}>
        Install WaniStats
      </Button>
    );
  }
  if (ios) {
    return (
      <ol className={styles.steps} aria-label="Add to Home Screen in Safari">
        <li>
          Tap <ShareIcon /> in Safari&apos;s toolbar.
        </li>
        <li>Choose Add to Home Screen.</li>
        <li>Tap Add.</li>
      </ol>
    );
  }
  return (
    <p className={styles.note}>
      To install, use your browser&apos;s Install app or Add to Home Screen option.
    </p>
  );
}
