import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import styles from './Sheet.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Modal via native <dialog>: showModal() makes the page inert, so focus stays inside. */
export function Sheet(props: Props) {
  return props.open ? <OpenSheet {...props} /> : null;
}

function OpenSheet({ onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);

  return (
    // Clicks on the dialog box itself (not its content) are clicks on the backdrop.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={styles.sheet}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
      // Fired by the Android back gesture, which sends no keydown.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
