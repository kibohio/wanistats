import { useUser } from '../db/hooks';
import { usePref } from '../db/prefs';
import { useAppMode } from '../db/useAppMode';
import styles from './Avatar.module.css';
import { AVATAR_GLYPHS } from './avatarGlyphs';
import { PersonIcon } from './icons';

type AvatarId = keyof typeof AVATAR_GLYPHS;

// Grounds come from the palette; ink follows the SRS text rule (dark on light grounds).
const AVATARS: { id: AvatarId; label: string; ground: string; ink: string }[] = [
  { id: 'wani', label: 'Crocodile', ground: 'var(--srs-guru-2)', ink: 'var(--on-srs-light)' },
  { id: 'kani', label: 'Crab', ground: 'var(--srs-burned)', ink: 'var(--on-srs-light)' },
  { id: 'kame', label: 'Turtle', ground: 'var(--srs-master)', ink: 'var(--on-srs-dark)' },
  { id: 'neko', label: 'Cat', ground: 'var(--srs-a2)', ink: 'var(--on-srs-light)' },
  { id: 'inu', label: 'Dog', ground: 'var(--srs-enlightened)', ink: 'var(--on-srs-dark)' },
  { id: 'yama', label: 'Mountain', ground: 'var(--surface)', ink: 'var(--ink)' },
  { id: 'hoshi', label: 'Star', ground: 'var(--primary-fill)', ink: 'var(--on-primary)' },
  { id: 'tsuki', label: 'Moon', ground: 'var(--accent-faint)', ink: 'var(--on-srs-light)' },
];

const isAvatar = (id: string | null): id is AvatarId => !!id && Object.hasOwn(AVATAR_GLYPHS, id);

/** A practice-paper square with one kanji. */
function AvatarArt({ id, size }: { id: AvatarId; size: number }) {
  const { ground, ink } = AVATARS.find((a) => a.id === id)!;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="16"
        strokeWidth="2"
        style={{ fill: ground, stroke: 'var(--line-strong)' }}
      />
      <path
        d="M50 10V90M10 50H90"
        strokeWidth="2"
        strokeDasharray="5 4"
        strokeOpacity="0.3"
        style={{ stroke: ink }}
      />
      <path d={AVATAR_GLYPHS[id].d} style={{ fill: ink }} />
    </svg>
  );
}

function Initial({ size }: { size: number }) {
  const user = useUser();
  return (
    <span className={styles.circle} style={{ width: size, height: size, fontSize: size * 0.44 }}>
      {user?.username.charAt(0).toUpperCase()}
    </span>
  );
}

/** The account's chosen avatar, else the username's initial; a person outline for sample data. */
export function UserAvatar({ size }: { size: number }) {
  const sample = useAppMode() === 'sample';
  const [avatar] = usePref('avatar');
  if (sample)
    return (
      <span className={styles.circle} style={{ width: size, height: size }}>
        <PersonIcon size={Math.round(size * 0.6)} />
      </span>
    );
  return isAvatar(avatar) ? <AvatarArt id={avatar} size={size} /> : <Initial size={size} />;
}

export function AvatarPicker({
  showLegend,
  onPick,
}: {
  showLegend?: boolean;
  onPick?: () => void;
}) {
  const [avatar, setAvatar] = usePref('avatar');
  const current = isAvatar(avatar) ? avatar : null;
  const pick = (id: AvatarId | null) => {
    void setAvatar(id);
    onPick?.();
  };
  return (
    <fieldset className={styles.picker}>
      <legend className={showLegend ? styles.legend : 'visually-hidden'}>Avatar</legend>
      <div className={styles.options}>
        <button
          type="button"
          aria-pressed={current === null}
          className={styles.option}
          onClick={() => pick(null)}
        >
          <Initial size={48} />
          <span>Initial</span>
        </button>
        {AVATARS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={current === a.id}
            className={styles.option}
            onClick={() => pick(a.id)}
          >
            <AvatarArt id={a.id} size={48} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
