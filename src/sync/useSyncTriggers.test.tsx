import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useSyncTriggers } from './useSync';

const calls = vi.fn();
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  syncAll: () => {
    calls();
    return Promise.resolve();
  },
}));
vi.mock('../db/useAppMode', async (orig) => ({
  ...(await orig<typeof import('../db/useAppMode')>()),
  useAppMode: () => 'live',
}));
vi.mock('../db/hooks', async (orig) => ({
  ...(await orig<typeof import('../db/hooks')>()),
  useTokenRejected: () => false,
}));

function Triggers() {
  useSyncTriggers();
  return null;
}

test('syncs on start and on return to the tab at most every 10 minutes, with no polling', async () => {
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 3, 14, 10) });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Triggers />
    </QueryClientProvider>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(calls).toHaveBeenCalledTimes(1);

  // No fixed interval: 8 quiet minutes, then a return to the tab inside the 10-minute gap.
  await act(() => vi.advanceTimersByTimeAsync(8 * 60_000));
  document.dispatchEvent(new Event('visibilitychange'));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(calls).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(3 * 60_000));
  document.dispatchEvent(new Event('visibilitychange'));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(calls).toHaveBeenCalledTimes(2);

  // One minute past the hour (15:01) always syncs.
  await act(() => vi.advanceTimersByTimeAsync(40 * 60_000));
  expect(calls).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});
