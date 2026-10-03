import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { RefreshData } from '../components/RefreshData';
import type { SyncProgress } from './sync';

let finish: () => void = () => {};
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  syncAll: (_db: unknown, onProgress: (p: SyncProgress) => void) => {
    onProgress({ step: 4, label: 'Your levels', loaded: 0, total: 0 });
    return new Promise<void>((r) => (finish = r));
  },
}));

afterEach(cleanup);

test('the step label gives way to "Synced just now" once the sync finishes', async () => {
  const client = new QueryClient();
  const { container } = render(
    <QueryClientProvider client={client}>
      <RefreshData />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
  // A second row that mounts mid-run, like Settings opened during a sync.
  const late = within(
    render(
      <QueryClientProvider client={client}>
        <RefreshData />
      </QueryClientProvider>,
    ).container,
  );
  expect(late.getByRole('status')).toHaveTextContent('Your levels (5 of 5)');

  await act(async () => finish());
  await waitFor(() =>
    expect(container.querySelector('[role=status]')).toHaveTextContent('Synced just now'),
  );
  expect(late.getByRole('status')).toBeEmptyDOMElement();
  expect(late.getByRole('button', { name: 'Refresh data' })).toBeEnabled();
});
