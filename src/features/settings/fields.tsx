import { useId, type ComponentProps, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { DayRange } from '../../components/DayRange';
import { Stepper } from '../../components/Stepper';
import { useUser } from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { fmtTime } from '../../domain/lessonWindow';
import { useInstall } from '../../hooks/useInstall';
import styles from './fields.module.css';

const MAX_LEVEL = 60;

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function StepperField(props: Omit<ComponentProps<typeof Stepper>, 'id'>) {
  return <Field label={props.label}>{(id) => <Stepper id={id} {...props} />}</Field>;
}

export function GoalLevelField() {
  const [goal, setGoal] = usePref('goalLevel');
  const min = Math.min((useUser()?.level ?? 1) + 1, MAX_LEVEL);
  return (
    <StepperField
      label="Goal level"
      value={Math.min(Math.max(goal, min), MAX_LEVEL)}
      min={min}
      max={MAX_LEVEL}
      onChange={(v) => void setGoal(v)}
    />
  );
}

export function WakingHoursFields() {
  const [wake, setWake] = usePref('wakeMin');
  const [sleep, setSleep] = usePref('sleepMin');
  return (
    <DayRange
      wake={wake}
      sleep={sleep}
      onWake={(v) => void setWake(v)}
      onSleep={(v) => void setSleep(v)}
    />
  );
}

export function LessonTimeField() {
  const [lessonMin, setLessonMin] = usePref('lessonMin');
  return (
    <StepperField
      label="Lesson time"
      value={lessonMin}
      min={0}
      max={1410}
      step={30}
      format={fmtTime}
      onChange={(v) => void setLessonMin(v)}
    />
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
