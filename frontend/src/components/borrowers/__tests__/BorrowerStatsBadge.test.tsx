import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { BorrowerStatsBadge } from '../BorrowerStatsBadge';
import type { BorrowerStatistics } from '../../../types/api.types';

function makeStatistics(overrides: Partial<BorrowerStatistics> = {}): BorrowerStatistics {
  return {
    totalLoans: 10,
    returnedOnTime: 8,
    returnedLate: 1,
    notReturned: 1,
    averageReturnDelay: 2,
    trustScore: 80,
    ...overrides,
  };
}

function renderBadge(statistics: BorrowerStatistics) {
  return render(
    <PaperProvider>
      <BorrowerStatsBadge statistics={statistics} />
    </PaperProvider>,
  );
}

describe('BorrowerStatsBadge', () => {
  it('should display the numeric trust score as a percentage', () => {
    renderBadge(makeStatistics({ trustScore: 87 }));

    expect(screen.getByTestId('trust-score')).toHaveTextContent('87%');
  });

  it('should display "Not yet rated" when trustScore is null (FIX-17)', () => {
    renderBadge(makeStatistics({ trustScore: null }));

    expect(screen.getByTestId('trust-score')).toHaveTextContent('Not yet rated');
    // Ensures the raw null value is never rendered as "null%"
    expect(screen.queryByText('null%')).toBeNull();
  });

  it('should not crash and hide the delay row when averageReturnDelay is null', () => {
    renderBadge(makeStatistics({ trustScore: 75, averageReturnDelay: null }));

    // Component renders without error
    expect(screen.getByTestId('stats-badge')).toBeTruthy();
    // Delay row is conditionally rendered — should be absent
    expect(screen.queryByText('Average delay')).toBeNull();
  });
});
