import { useLiveQuery as useDexieLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';

// Last result per query, so a screen that mounts again renders its data on the first frame
// instead of flashing an empty state while IndexedDB answers.
const last = new Map<string, unknown>();

const depKey = (d: unknown) => (d instanceof Dexie ? `db:${d.name}` : (JSON.stringify(d) ?? ''));

/** Drop-in for dexie-react-hooks' useLiveQuery that starts from the previous result. */
export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = [],
): T | undefined {
  // ponytail: keyed by the querier's source plus its deps; fine for this app's few dozen queries.
  const key = `${querier.toString()}|${deps.map(depKey).join('|')}`;
  return useDexieLiveQuery(
    async () => {
      const result = await querier();
      last.set(key, result);
      return result;
    },
    deps,
    last.get(key) as T | undefined,
  );
}
