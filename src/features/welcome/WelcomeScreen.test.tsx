import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Onboarding } from './WelcomeScreen';

const glance = [
  { label: 'Next level-up', value: 'Tue 6 Oct, 16:00', note: '18 of 30 kanji at Guru' },
  { label: 'Workload', value: 'Load 128', note: 'Inside the 100 to 150 band' },
  { label: 'Level 60', value: '7 Jul 2027', note: '7.2 days per level' },
];

const current = () =>
  screen.getAllByRole('listitem').findIndex((li) => li.getAttribute('aria-current') === 'step');

test('walks three steps with progress and ends with Go to Today', async () => {
  const onDone = vi.fn();
  render(<Onboarding glance={glance} onDone={onDone} />);

  expect(screen.getByRole('heading', { name: 'Your WaniKani, at a glance' })).toBeInTheDocument();
  expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  expect(current()).toBe(0);
  expect(screen.getByText('Load 128')).toBeInTheDocument();
  expect(screen.getByText('Tue 6 Oct, 16:00')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading', { name: 'Open WaniStats once a day' })).toBeInTheDocument();
  expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  expect(current()).toBe(1);

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading', { name: 'Keep it one tap away' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Goal level')).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Go to Today' }));
  expect(onDone).toHaveBeenCalledOnce();
});

test('Skip leaves from any step', async () => {
  const onDone = vi.fn();
  render(<Onboarding glance={undefined} onDone={onDone} />);
  expect(screen.getByText(/appear here after the first sync/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(onDone).toHaveBeenCalledOnce();
});
