import { useState } from 'react';
import styles from './Stepper.module.css';

interface Props {
  /** For an external <label htmlFor>. */
  id?: string;
  /** Names the buttons: "Increase goal level". */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Shows the value as text, e.g. a time, instead of a typable number. */
  format?: (value: number) => string;
}

/** − / value / +, clamped to min..max. */
export function Stepper({ id, label, value, min, max, step = 1, onChange, format }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  // Local value so fast clicks step from the last click, not from a store that hasn't caught up.
  // Own text so a half-typed number isn't overwritten by the stored value.
  const [cur, setCur] = useState(value);
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // Last value sent; stale stored values arriving before it are ignored.
  const [sent, setSent] = useState<number | null>(null);
  if (shown !== value) {
    setShown(value);
    if (sent === null || sent === value) {
      setSent(null);
      setCur(value);
      setText(String(value));
    }
  }
  const send = (n: number) => {
    setCur(n);
    if (n !== cur) {
      // Back to the stored value: the store may never echo it, so don't wait for it.
      setSent(n === value ? null : n);
      onChange(n);
    }
  };
  const commit = (n: number) => {
    const c = clamp(Number.isFinite(n) ? Math.round(n) : cur);
    setText(String(c));
    send(c);
  };
  const name = label.toLowerCase();

  return (
    <span className={styles.stepper}>
      <button
        type="button"
        aria-label={`Decrease ${name}`}
        disabled={cur <= min}
        onClick={() => commit(cur - step)}
      >
        −
      </button>
      {format ? (
        <output id={id} className={styles.value} aria-live="polite">
          {format(cur)}
        </output>
      ) : (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className={styles.value}
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) send(n);
          }}
          onBlur={() => commit(text === '' ? cur : Number(text))}
          onKeyDown={(e) => e.key === 'Enter' && commit(text === '' ? cur : Number(text))}
        />
      )}
      <button
        type="button"
        aria-label={`Increase ${name}`}
        disabled={cur >= max}
        onClick={() => commit(cur + step)}
      >
        +
      </button>
    </span>
  );
}
