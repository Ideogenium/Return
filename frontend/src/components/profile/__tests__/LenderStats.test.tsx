import { render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { LenderStats } from '../LenderStats';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import type { HistoryStatistics } from '../../../types/api.types';

// Helper to build a minimal HistoryStatistics fixture
function makeStats(overrides: Partial<HistoryStatistics['overview']> = {}): HistoryStatistics {
  return {
    overview: {
      totalLoans: 0,
      activeLoans: 0,
      returnedLoans: 0,
      notReturnedLoans: 0,
      contestedLoans: 0,
      overdueLoans: 0,
      averageReturnDelay: 0,
      ...overrides,
    },
    byCategory: [],
    topBorrowers: [],
    mostLoanedItems: [],
  };
}

function renderStats() {
  return render(
    <PaperProvider>
      <LenderStats />
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useHistoryStore.getState().reset();
});
afterAll(() => server.close());

describe('LenderStats (unified)', () => {
  describe('lender section — reads from useHistoryStore', () => {
    it('should render both lender and borrower sections', async () => {
      useHistoryStore.setState({ statistics: makeStats() });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      expect(screen.getByText('My loans')).toBeTruthy();
      expect(screen.getByText('My borrowings')).toBeTruthy();
    });

    it('should display lender overview values from the store', async () => {
      useHistoryStore.setState({
        statistics: makeStats({ totalLoans: 5, activeLoans: 2, returnedLoans: 3 }),
      });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      // Each stat value is rendered as a Text node — check for numeric display
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('should display activeLoans as-is from the store (no client-side over-counting — FIX-06 non-regression)', async () => {
      // The backend endpoint already excludes CONTESTED loans from activeLoans.
      // The component must display the raw value — no filtering on the client.
      useHistoryStore.setState({
        statistics: makeStats({ totalLoans: 9, activeLoans: 7, returnedLoans: 2 }),
      });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      // activeLoans value (7) is displayed verbatim from the store — no client recount
      expect(screen.getByText('7')).toBeTruthy();
    });

    it('should fall back to zeros when statistics is null in the store', async () => {
      // statistics stays null (default after reset) — no crash, values default to 0
      useHistoryStore.setState({ statistics: null });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      // Three lender stat cards each display "0"
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });

    it('should display the overdue loans card with its count (FEAT-04)', async () => {
      // 7 is distinct from every other value on screen (MSW borrower defaults: 87%, 40, 31, 8)
      useHistoryStore.setState({
        statistics: makeStats({
          totalLoans: 10,
          activeLoans: 3,
          returnedLoans: 6,
          overdueLoans: 7,
        }),
      });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      // "Overdue" is the en.json translation for profile.overdueLoans
      expect(screen.getByText('Overdue')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
    });

    it('should display contested and not-returned loan counts (new cards)', async () => {
      // Values chosen to be distinct from each other, from the MSW borrower defaults
      // (87%, 40, 31, 8) and from any overview field left at 0 — no collision risk.
      useHistoryStore.setState({
        statistics: makeStats({
          totalLoans: 10,
          activeLoans: 3,
          returnedLoans: 4,
          contestedLoans: 2,
          notReturnedLoans: 1,
        }),
      });

      renderStats();

      await waitFor(() => expect(screen.getByTestId('lender-stats')).toBeTruthy());

      // Labels from i18n (en): profile.contestedLoans → "Contested", profile.notReturnedLoans → "Not returned"
      expect(screen.getByText('Contested')).toBeTruthy();
      expect(screen.getByText('Not returned')).toBeTruthy();

      // Values: 2 (contestedLoans) and 1 (notReturnedLoans)
      // Neither appears in the MSW trust-score response (87%, 40, 31, 8)
      // nor in any other overview field (remaining fields default to 0 via makeStats spread)
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  describe('borrower section — reads from GET /users/me/trust-score via MSW', () => {
    it('should display the global borrower stats from GET /users/me/trust-score (FIX-15)', async () => {
      // Default handler → { trustScore:87, totalLoans:40, returnedOnTime:31, returnedLate:8 }
      // The whole borrower section is server-sourced — no client recalculation.
      useHistoryStore.setState({ statistics: makeStats() });
      renderStats();
      await waitFor(() => {
        expect(screen.getByText('87%')).toBeTruthy();
      });
      expect(screen.getByText('40')).toBeTruthy();
      expect(screen.getByText('31')).toBeTruthy();
      expect(screen.getByText('8')).toBeTruthy();
    });

    it('should display "Not yet rated" when the global endpoint is unavailable (FIX-15, FIX-17)', async () => {
      // Endpoint error → borrowerStats stays null → trustScore card shows "Not yet rated" instead of "0%".
      server.use(
        http.get('*/users/me/trust-score', () =>
          HttpResponse.json({ detail: 'Not Found' }, { status: 404 }),
        ),
      );
      useHistoryStore.setState({ statistics: makeStats() });
      renderStats();
      await waitFor(() => {
        expect(screen.getByText('Not yet rated')).toBeTruthy();
      });
    });

    it('should display "Not yet rated" when trustScore is null (FIX-17)', async () => {
      // Backend returns null trustScore (no resolved loans yet) — numeric counters are present.
      server.use(
        http.get('*/users/me/trust-score', () =>
          HttpResponse.json({
            trustScore: null,
            totalLoans: 5,
            returnedOnTime: 4,
            returnedLate: 1,
            notReturned: 0,
          }),
        ),
      );
      useHistoryStore.setState({ statistics: makeStats() });
      renderStats();
      await waitFor(() => {
        expect(screen.getByText('Not yet rated')).toBeTruthy();
      });
    });

    it('should keep borrower section intact alongside lender section (non-regression)', async () => {
      useHistoryStore.setState({
        statistics: makeStats({ totalLoans: 5, activeLoans: 2, returnedLoans: 3 }),
      });

      renderStats();

      await waitFor(() => {
        expect(screen.getByTestId('lender-stats')).toBeTruthy();
      });

      // Trust score card from borrower section is present
      expect(screen.getByText('Trust')).toBeTruthy();
    });
  });
});
