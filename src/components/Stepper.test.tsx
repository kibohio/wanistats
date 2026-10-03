import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { Stepper } from './Stepper';

function Harness({ onChange, start = 20 }: { onChange: (v: number) => void; start?: number }) {
  const [v, setV] = useState(start);
  return (
    <>
      <label htmlFor="goal">Goal level</label>
      <Stepper
        id="goal"
        label="Goal level"
        value={v}
        min={11}
        max={60}
        onChange={(n) => {
          setV(n);
          onChange(n);
        }}
      />
    </>
  );
}

test('clamps typed values to the range on blur', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const input = screen.getByLabelText('Goal level');

  await user.clear(input);
  await user.type(input, '99');
  await user.tab();
  expect(input).toHaveValue(60);
  expect(onChange).toHaveBeenLastCalledWith(60);

  await user.clear(input);
  await user.type(input, '3');
  await user.tab();
  expect(input).toHaveValue(11);
  expect(onChange).toHaveBeenLastCalledWith(11);

  await user.clear(input);
  await user.type(input, '42');
  expect(onChange).toHaveBeenLastCalledWith(42);
});

test('buttons step within the range and stop at its ends', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} start={59} />);
  const up = screen.getByRole('button', { name: 'Increase goal level' });

  await user.click(up);
  expect(screen.getByLabelText('Goal level')).toHaveValue(60);
  expect(up).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Decrease goal level' }));
  expect(onChange).toHaveBeenLastCalledWith(59);
});

test('shows a formatted value when given a format', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Stepper
      label="Lesson time"
      value={540}
      min={0}
      max={1410}
      step={30}
      format={(m) => `${m / 60}h`}
      onChange={onChange}
    />,
  );
  expect(screen.getByText('9h')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Increase lesson time' }));
  expect(onChange).toHaveBeenCalledWith(570);
});

test('two fast clicks step twice while the stored value catches up', async () => {
  const onChange = vi.fn();
  // Stores like an async pref: the new value comes back a tick later.
  function AsyncHarness() {
    const [v, setV] = useState(15);
    return (
      <Stepper
        label="Lessons a day"
        value={v}
        min={0}
        max={100}
        onChange={(n) => {
          onChange(n);
          setTimeout(() => setV(n), 0);
        }}
      />
    );
  }
  render(<AsyncHarness />);
  const up = screen.getByRole('button', { name: 'Increase lessons a day' });

  fireEvent.click(up);
  fireEvent.click(up);
  expect(onChange.mock.calls).toEqual([[16], [17]]);
  expect(screen.getByRole('spinbutton')).toHaveValue(17);

  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(17));
  await new Promise((r) => setTimeout(r, 10));
  expect(screen.getByRole('spinbutton')).toHaveValue(17);
});
