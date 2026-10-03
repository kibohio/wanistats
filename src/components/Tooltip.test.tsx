import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Tooltip } from './Tooltip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () =>
  render(
    <Tooltip content="Apprentice 1">
      <button type="button">A1</button>
    </Tooltip>,
  );

test('shows after a hover delay, describes the trigger, hides on Escape', () => {
  setup();
  const button = screen.getByRole('button');
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  act(() => vi.advanceTimersByTime(400));
  const tip = screen.getByRole('tooltip', { hidden: true });
  expect(tip.textContent).toBe('Apprentice 1');
  expect(button.getAttribute('aria-describedby')).toBe(tip.id);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  expect(button.hasAttribute('aria-describedby')).toBe(false);
});

test('a touch never opens it, and a click closes it', () => {
  setup();
  const button = screen.getByRole('button');
  fireEvent.pointerEnter(button, { pointerType: 'touch' });
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(400));
  fireEvent.click(button);
  expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
});
