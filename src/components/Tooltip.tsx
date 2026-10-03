import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import styles from './Tooltip.module.css';

const SHOW_DELAY = 350;
const HIDE_DELAY = 100;
const GAP = 8;
const EDGE = 8;

interface Props {
  content: ReactNode;
  /** One element; it gets aria-describedby while the tooltip shows. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

/**
 * Hover (mouse and pen) after a short delay, or keyboard focus. Touch taps never open it, so a tap
 * still reaches the trigger. A manual popover sits in the top layer, above open sheets and outside
 * any scrolling list that would clip it.
 */
export function Tooltip({ content, children }: Props) {
  const id = useId();
  const [anchor, setAnchor] = useState<Element | null>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setAnchor(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    const el = tip.current;
    if (!anchor || !el) return;
    el.showPopover?.();
    // Above, centred, kept on screen; below when there is no room above.
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      const above = a.top - GAP - t.height;
      el.style.top = `${above >= EDGE ? above : a.bottom + GAP}px`;
      el.style.left = `${Math.min(
        Math.max(EDGE, a.left + a.width / 2 - t.width / 2),
        window.innerWidth - t.width - EDGE,
      )}px`;
    };
    place();
    // Content that loads its own data grows after the first frame.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    ro?.observe(el);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    addEventListener('keydown', onKey, true);
    addEventListener('scroll', hide, true);
    return () => {
      ro?.disconnect();
      removeEventListener('keydown', onKey, true);
      removeEventListener('scroll', hide, true);
    };
  }, [anchor]);

  return (
    // Listens to events bubbling from its one child; the span itself has no box (display: contents).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <span
      className={styles.anchor}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return;
        const el = e.currentTarget.firstElementChild;
        // Moving onto the open tooltip and back keeps it open.
        later(() => setAnchor(el), anchor ? 0 : SHOW_DELAY);
      }}
      onPointerLeave={() => later(() => setAnchor(null), HIDE_DELAY)}
      onFocus={(e) => {
        // Tap focus is not focus-visible, so taps on Android do not open it either.
        if (e.target.matches(':focus-visible')) setAnchor(e.currentTarget.firstElementChild);
      }}
      onBlur={hide}
      onClick={hide}
    >
      {cloneElement(children, { 'aria-describedby': anchor ? id : undefined })}
      {anchor && (
        <span ref={tip} id={id} role="tooltip" popover="manual" className={styles.tip}>
          {content}
        </span>
      )}
    </span>
  );
}
