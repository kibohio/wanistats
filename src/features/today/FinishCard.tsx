import { Link } from '@tanstack/react-router';
import { formatDate, formatMonthRange } from '../../format';
import { days1 } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

const Chevron = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={styles.chevron}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** Indigo panel linking to Pace, which explains every figure on it. */
export function FinishCard({ d, desktop }: { d: TodayData; desktop?: boolean }) {
  const f = d.finish;
  const range =
    f?.lowAt != null && f.highAt != null
      ? `Likely between ${formatMonthRange(f.lowAt, f.highAt).join(' and ')}.`
      : '';
  let head: string, figure: string, body: string;
  if (!f) {
    head = 'Finish date';
    figure = 'Not yet';
    body = 'Shows up once a full level is done.';
  } else if (f.reached) {
    head = `Level ${f.goal}`;
    figure = 'Reached';
    body = 'Set a new goal level on Pace.';
  } else {
    head = `Level ${f.goal} projected`;
    figure = formatDate(f.finishAt!);
    const pace = days1(d.pace.medianDays!);
    const median = d.hasReset
      ? `median since ${d.sample ? 'the' : 'your'} reset`
      : `${d.sample ? "the sample's" : 'your'} median`;
    body = desktop
      ? `${pace} days per level (${median}). ${range}`
      : `${pace} days per level. ${range}`;
  }
  return (
    <Link to="/pace" className={desktop ? styles.finishDesktop : styles.finish}>
      <div className={styles.finishMain}>
        <span className={styles.finishHead}>{head}</span>
        <span className={styles.finishDate}>{figure}</span>
        <span className={styles.finishBody}>{body.trim()}</span>
      </div>
      {desktop ? (
        <dl className={styles.finishList}>
          {f?.fastestAt != null && (
            <div>
              <dt>Fastest possible</dt>
              <dd>{formatDate(f.fastestAt)}</dd>
            </div>
          )}
          <div>
            <dt>All Guru up to</dt>
            <dd>{d.guruThrough ? `Level ${d.guruThrough}` : 'None yet'}</dd>
          </div>
          <div>
            <dt>All burned up to</dt>
            <dd>{d.burnedThrough ? `Level ${d.burnedThrough}` : 'None yet'}</dd>
          </div>
        </dl>
      ) : (
        <Chevron />
      )}
    </Link>
  );
}
