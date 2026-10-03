import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Projection } from './Projection';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 3, 12);

describe('Projection', () => {
  it('waits for a passed level, then projects a what-if pace from the slider', () => {
    render(
      <Projection
        level={1}
        maxLevelGranted={60}
        earliestLevelUpAt={now + 4 * DAY}
        onVacation={false}
        stats={{
          rows: [],
          medianDays: null,
          p25Days: null,
          p75Days: null,
          meanAllDays: null,
          medianAllDays: null,
        }}
        minLevelTimes={new Map()}
        guruThrough={0}
        burnedThrough={0}
        now={now}
        owner="your"
      />,
    );
    expect(screen.getByText(/Pass one level to get a projection/)).toBeInTheDocument();
    expect(screen.queryByText(/days away/)).toBeNull();

    // Goal 60 from level 1: 58 levels after the next level-up at 10 days each.
    fireEvent.change(screen.getByLabelText('Days per level'), { target: { value: '10' } });
    expect(screen.getByText(`${4 + 580} days away`)).toBeInTheDocument();
    expect(screen.getByText(/What-if pace\. No passed levels yet\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use median' })).toBeNull();
  });
});
