export type AppMode = 'sample' | 'live';

// ponytail: always sample until login lands; then read the auth table with useLiveQuery.
export function useAppMode(): AppMode {
  return 'sample';
}
