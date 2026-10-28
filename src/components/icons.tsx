import type { ReactNode, SVGProps } from 'react';

// Stroke icons drawn on a 24 px grid, as in the mockups.
function icon(paths: ReactNode) {
  return function Icon({ size = 22, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const TodayIcon = icon(
  <>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </>,
);
export const TimelineIcon = icon(<path d="M5 19V12M10 19V6M15 19V10M20 19V14M3 21h18" />);
export const PaceIcon = icon(<path d="M3 17l6-6 4 4 8-8M15 7h6v6" />);
export const KanjiIcon = icon(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </>,
);
export const ItemsIcon = icon(<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" />);
export const ReadingsIcon = icon(<path d="M4 5h16v11H10l-5 4v-4H4z" />);
export const RefreshIcon = icon(<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />);
export const PersonIcon = icon(
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </>,
);
export const ChevronDownIcon = icon(<path d="M6 9l6 6 6-6" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>,
);
export const ExternalIcon = icon(
  <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
);
