import { useState } from 'react';
import { formatMinutes } from '../format';
import { useClock } from '../hooks/useClock';
import styles from './DayRange.module.css';

const DAY = 1440;
const pct = (min: number) => `${(min / DAY) * 100}%`;

/** Shows a dragged value at once instead of snapping back until the stored one arrives. */
function useDragged(value: number, set: (v: number) => void): [number, (v: number) => void] {
  const [pending, setPending] = useState<number | null>(null);
  if (pending !== null && pending === value) setPending(null);
  return [
    pending ?? value,
    (v) => {
      setPending(v);
      set(v);
    },
  ];
}

interface Props {
  /** Minutes since midnight. Sleep earlier than wake means the day crosses midnight. */
  wake: number;
  sleep: number;
  onWake: (min: number) => void;
  onSleep: (min: number) => void;
}

/** A 24-hour bar with wake and sleep handles in 30-minute steps. */
export function DayRange(props: Props) {
  const [wake, onWake] = useDragged(props.wake, props.onWake);
  const [sleep, onSleep] = useDragged(props.sleep, props.onSleep);
  const clock = useClock();
  const fmtTime = (m: number) => formatMinutes(m, clock);
  const midnight = formatMinutes(0, clock, true);
  const spans: [number, number][] =
    wake % DAY === sleep % DAY
      ? [[0, DAY]]
      : wake < sleep
        ? [[wake, sleep]]
        : [
            [wake, DAY],
            [0, sleep],
          ];
  const handle = (label: string, value: number, set: (v: number) => void) => (
    <input
      type="range"
      aria-label={label}
      aria-valuetext={fmtTime(value)}
      min={0}
      max={DAY}
      step={30}
      value={value}
      onChange={(e) => set(Number(e.target.value))}
    />
  );

  return (
    <div className={styles.range}>
      <div className={styles.head}>
        <span>Waking hours</span>
        <span className={styles.times}>
          {fmtTime(wake)} to {fmtTime(sleep)}
        </span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar}>
          {spans.map(([from, to]) => (
            <span key={from} style={{ left: pct(from), width: pct(to - from) }} />
          ))}
        </div>
        {handle('Wake up', wake, onWake)}
        {handle('Go to sleep', sleep, onSleep)}
      </div>
      <div aria-hidden="true" className={styles.ticks}>
        <span>{midnight}</span>
        <span>{formatMinutes(720, clock, true)}</span>
        <span>{midnight === '00:00' ? '24:00' : midnight}</span>
      </div>
    </div>
  );
}
