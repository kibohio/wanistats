import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { Sheet } from './Sheet';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open menu</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
        <a href="/settings">Settings</a>
      </Sheet>
    </>
  );
}

test('moves focus into the sheet, closes on Escape and returns focus', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open menu' });

  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Menu' });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
