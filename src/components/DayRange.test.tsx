import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { DayRange } from './DayRange';

function Harness() {
  const [wake, setWake] = useState(420);
  const [sleep, setSleep] = useState(1380);
  return <DayRange wake={wake} sleep={sleep} onWake={setWake} onSleep={setSleep} />;
}

// Arrow keys are the browser's own range stepping, which jsdom lacks; e2e/app.spec.ts covers them.
test('handles step in 30 minutes and read as times', () => {
  render(<Harness />);
  const wake = screen.getByRole('slider', { name: 'Wake up' });
  expect(wake).toHaveAttribute('step', '30');
  expect(wake).toHaveAttribute('aria-valuetext', '07:00');
  fireEvent.change(wake, { target: { value: '450' } });
  expect(wake).toHaveAttribute('aria-valuetext', '07:30');
  expect(screen.getByText('07:30 to 23:00')).toBeInTheDocument();
});

test('sleep can fall after midnight', () => {
  render(<Harness />);
  const sleep = screen.getByRole('slider', { name: 'Go to sleep' });
  fireEvent.change(sleep, { target: { value: '60' } });
  expect(sleep).toHaveAttribute('aria-valuetext', '01:00');
  expect(screen.getByText('07:00 to 01:00')).toBeInTheDocument();
});
