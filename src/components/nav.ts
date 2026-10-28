import { ItemsIcon, KanjiIcon, PaceIcon, ReadingsIcon, TimelineIcon, TodayIcon } from './icons';

export const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { to: '/pace', label: 'Pace', Icon: PaceIcon },
  { to: '/coverage', label: 'Coverage', Icon: KanjiIcon },
  { to: '/items', label: 'Items', Icon: ItemsIcon },
] as const;

// The phone tab bar has no room for a sixth tab; Items links to the drill there.
export const SIDEBAR_TABS = [
  ...TABS,
  { to: '/readings', label: "On'yomi drill", Icon: ReadingsIcon },
] as const;
