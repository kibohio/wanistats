import styles from './SegmentedControl.module.css';

interface Props<T extends string> {
  /** Accessible name of the group, e.g. "Range". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  return (
    <div role="group" aria-label={label} className={`${styles.group} ${className ?? ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={styles.option}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
