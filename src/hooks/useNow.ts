import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `everyMs` so projections and "in 3 hours" stay live. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
