import { ItemsIcon, KanjiIcon, PaceIcon, SettingsIcon, TimelineIcon, TodayIcon } from './icons';

export const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { to: '/pace', label: 'Pace', Icon: PaceIcon },
  { to: '/kanji', label: 'Kanji', Icon: KanjiIcon },
  { to: '/items', label: 'Items', Icon: ItemsIcon },
] as const;

export const SETTINGS = { to: '/settings', label: 'Settings', Icon: SettingsIcon } as const;
