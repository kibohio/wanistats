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
  // Own text so a half-typed number isn't overwritten by the stored value.
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const commit = (n: number) => {
    const c = clamp(Number.isFinite(n) ? Math.round(n) : value);
    setText(String(c));
    if (c !== value) onChange(c);
  };
  const name = label.toLowerCase();

  return (
    <span className={styles.stepper}>
      <button
        type="button"
        aria-label={`Decrease ${name}`}
        disabled={value <= min}
        onClick={() => commit(value - step)}
      >
        −
      </button>
      {format ? (
        <output id={id} className={styles.value} aria-live="polite">
          {format(value)}
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
            if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => commit(text === '' ? value : Number(text))}
          onKeyDown={(e) => e.key === 'Enter' && commit(text === '' ? value : Number(text))}
        />
      )}
      <button
        type="button"
        aria-label={`Increase ${name}`}
        disabled={value >= max}
        onClick={() => commit(value + step)}
      >
        +
      </button>
    </span>
  );
}
