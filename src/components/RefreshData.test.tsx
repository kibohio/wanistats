import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { RefreshDataView } from './RefreshData';

const base = {
  running: false,
  progress: null,
  justSynced: false,
  error: null,
  offline: false,
  onRefresh: () => {},
};

afterEach(cleanup);

const button = () => screen.getByRole('button', { name: 'Refresh data' });

test('idle: enabled, no caption, runs a sync on press', async () => {
  const onRefresh = vi.fn();
  render(<RefreshDataView {...base} onRefresh={onRefresh} />);
  expect(button()).toBeEnabled();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  await userEvent.click(button());
  expect(onRefresh).toHaveBeenCalledOnce();
});

test('running: disabled and names the current step', () => {
  render(
    <RefreshDataView
      {...base}
      running
      progress={{ step: 2, label: 'Your progress', loaded: 0, total: 0 }}
    />,
  );
  expect(button()).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Your progress (3 of 5)');
});

test('done: says it synced just now', () => {
  render(<RefreshDataView {...base} justSynced />);
  expect(button()).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Synced just now');
});

test('offline: disabled with the offline message', () => {
  render(<RefreshDataView {...base} offline />);
  expect(button()).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(
    "You're offline. Try again when you're connected.",
  );
});
