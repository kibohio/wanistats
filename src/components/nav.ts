import { ItemsIcon, KanjiIcon, PaceIcon, TimelineIcon, TodayIcon } from './icons';

export const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { to: '/pace', label: 'Pace', Icon: PaceIcon },
  { to: '/kanji', label: 'Kanji', Icon: KanjiIcon },
  { to: '/items', label: 'Items', Icon: ItemsIcon },
] as const;
