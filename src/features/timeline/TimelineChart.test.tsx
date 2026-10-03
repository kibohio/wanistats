import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { TimelineBin } from '../../domain/timeline';
import { TimelineChart } from './TimelineChart';
import type { TimelineData } from './useTimelineData';

const DAY = 86_400_000;
const start = new Date(2026, 9, 3).getTime();

function bin(i: number, apprentice: number, extra: Partial<TimelineBin> = {}): TimelineBin {
  return {
    start: start + i * DAY,
    end: start + (i + 1) * DAY,
    counts: { apprentice, guru: 0, master: 0, enlightened: 0 },
    total: apprentice,
    critical: 0,
    burns: 0,
    estimate: 0,
    runningTotal: 0,
    runningEstimate: 0,
    subjectIds: [],
    ...extra,
  };
}

const data: TimelineData = {
  timeline: {
    keys: ['apprentice', 'guru', 'master', 'enlightened'],
    bins: [bin(0, 4), bin(1, 7, { critical: 1, subjectIds: [10] }), bin(2, 2)],
    total: 13,
    estimateTotal: 0,
  },
  items: new Map([[10, { char: '島', stage: 2, critical: true }]]),
  lessonsPerDay: 15,
};

test('arrow keys move the selection between bars and the panel follows', async () => {
  const user = userEvent.setup();
  render(<TimelineChart data={data} granularity="day" memoryKey="keys" />);
  const bars = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
  expect(bars).toHaveLength(3);
  expect(bars[0]).toHaveAttribute('aria-pressed', 'true');
  expect(bars[0]).toHaveAccessibleName(/^Rest of today, 4 reviews$/);
  expect(screen.getByText('Apprentice 4, Guru 0, Master 0, Enlightened 0')).toBeInTheDocument();

  await user.tab();
  expect(bars[0]).toHaveFocus();

  await user.keyboard('{ArrowRight}');
  expect(bars[1]).toHaveFocus();
  expect(bars[1]).toHaveAttribute('aria-pressed', 'true');
  expect(bars[0]).toHaveAttribute('tabindex', '-1');
  expect(bars[1]).toHaveAccessibleName(/7 reviews, 1 level-critical$/);
  expect(screen.getByText('Apprentice 7, Guru 0, Master 0, Enlightened 0')).toBeInTheDocument();
  expect(screen.getByText('1 level-critical.')).toBeInTheDocument();
  expect(
    within(screen.getByRole('list', { name: '1 item in this slot' })).getByRole('button'),
  ).toHaveAccessibleName('島, Apprentice 2, level-critical');

  await user.keyboard('{End}');
  expect(bars[2]).toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(bars[2]).toHaveFocus();

  await user.keyboard('{Home}');
  expect(bars[0]).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(bars[0]).toHaveAttribute('aria-pressed', 'true');
});

const pressed = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .findIndex((b) => b.getAttribute('aria-pressed') === 'true');

test('the selected bar survives unmount and falls back to the first once it has passed', async () => {
  const user = userEvent.setup();
  const first = render(<TimelineChart data={data} granularity="day" memoryKey="remount" />);
  await user.click(screen.getByRole('button', { name: /, 7 reviews/ }));
  expect(pressed()).toBe(1);
  first.unmount();

  const again = render(<TimelineChart data={data} granularity="day" memoryKey="remount" />);
  expect(pressed()).toBe(1);
  again.unmount();

  // A day later the remembered bar is the first one, and it stays selected.
  const later = { ...data, timeline: { ...data.timeline, bins: data.timeline.bins.slice(1) } };
  const shifted = render(<TimelineChart data={later} granularity="day" memoryKey="remount" />);
  expect(pressed()).toBe(0);
  expect(screen.getByText('Apprentice 7, Guru 0, Master 0, Enlightened 0')).toBeInTheDocument();
  shifted.unmount();

  // Two days later it is gone: the first bar is selected.
  const gone = { ...data, timeline: { ...data.timeline, bins: data.timeline.bins.slice(2) } };
  render(<TimelineChart data={gone} granularity="day" memoryKey="remount" />);
  expect(pressed()).toBe(0);
  expect(screen.getByText('Apprentice 2, Guru 0, Master 0, Enlightened 0')).toBeInTheDocument();
});
