import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { LoanTimeline } from '../LoanTimeline';
import type { Loan } from '../../../types/api.types';

// Base loan factory — only the fields used by LoanTimeline
function makeLoan(overrides: Partial<Loan>): Loan {
  return {
    id: 'loan-test-id',
    status: 'ACTIVE',
    createdAt: '2024-01-10T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    confirmationDate: '2024-01-11T10:00:00.000Z',
    returnDate: '2024-02-10T10:00:00.000Z',
    returnedDate: null,
    notes: null,
    contestReason: null,
    item: {
      id: 'item-1',
      name: 'Perceuse Bosch',
      category: 'TOOLS',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    lender: { id: 'user-1', firstName: 'Alice', lastName: 'Martin' },
    borrower: {
      id: 'borrower-1',
      firstName: 'Bob',
      lastName: 'Dupont',
      email: 'bob@example.com',
    },
    ...overrides,
  };
}

function renderTimeline(loan: Loan) {
  return render(
    <PaperProvider>
      <LoanTimeline loan={loan} />
    </PaperProvider>,
  );
}

describe('LoanTimeline — FIX-12 : étape active sans date pour prêts en cours', () => {
  // FIX-12 : statut ACTIVE — la confirmationDate ne doit pas apparaître à l'étape active
  it('should not display any date on the active step when status is ACTIVE', () => {
    const confirmationDate = '2024-01-20T10:00:00.000Z';
    const loan = makeLoan({
      status: 'ACTIVE',
      createdAt: '2024-01-15T10:00:00.000Z',
      confirmationDate,
      returnDate: '2024-02-10T10:00:00.000Z',
    });

    renderTimeline(loan);

    expect(screen.getByTestId('loan-timeline')).toBeTruthy();
    // The active step must not carry a date — confirmationDate must not appear anywhere in the render.
    // The component may format it as a date range in a single Text node, so we use a substring matcher.
    const expectedConfirmationStr = new Date(confirmationDate).toLocaleDateString();
    expect(screen.queryByText(expectedConfirmationStr, { exact: false })).toBeNull();
    // And still no "Invalid Date"
    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });

  // FIX-12 : statut ACTIVE_BY_DEFAULT — idem, la confirmationDate ne doit pas apparaître à l'étape active
  it('should not display any date on the active step when status is ACTIVE_BY_DEFAULT', () => {
    const confirmationDate = '2024-01-20T10:00:00.000Z';
    const loan = makeLoan({
      status: 'ACTIVE_BY_DEFAULT',
      createdAt: '2024-01-15T10:00:00.000Z',
      confirmationDate, // distinct and valid — makes the absence assertion meaningful
      returnDate: '2024-02-10T10:00:00.000Z',
    });

    renderTimeline(loan);

    expect(screen.getByTestId('loan-timeline')).toBeTruthy();
    // Same criterion: the formatted confirmationDate must not appear anywhere
    const expectedConfirmationStr = new Date(confirmationDate).toLocaleDateString();
    expect(screen.queryByText(expectedConfirmationStr, { exact: false })).toBeNull();
    // And still no "Invalid Date"
    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });

  // FIX-12 : "Invalid Date" ne doit JAMAIS apparaître — confirmationDate absente/invalide
  it('should never render the string "Invalid Date" when confirmationDate is absent', () => {
    const loan = makeLoan({
      status: 'ACTIVE',
      confirmationDate: null,
      returnDate: null,
    });

    renderTimeline(loan);

    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });

  // FIX-12 : "Invalid Date" ne doit JAMAIS apparaître — confirmationDate malformée
  it('should never render the string "Invalid Date" when confirmationDate is malformed', () => {
    const loan = makeLoan({
      status: 'ACTIVE',
      confirmationDate: 'not-a-valid-date',
      returnDate: 'also-invalid',
    });

    renderTimeline(loan);

    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });

  // Non-régression : RETURNED doit continuer d'afficher une date à l'étape active
  it('should still display a date on the active step when status is RETURNED', () => {
    const loan = makeLoan({
      status: 'RETURNED',
      confirmationDate: '2024-01-11T10:00:00.000Z',
      returnDate: '2024-02-10T10:00:00.000Z',
      returnedDate: '2024-02-08T10:00:00.000Z',
    });

    renderTimeline(loan);

    expect(screen.getByTestId('loan-timeline')).toBeTruthy();
    // At least two dates should appear: createdAt (step 1) + active period (step 2)
    const allTexts = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(allTexts.length).toBeGreaterThanOrEqual(2);
    // And still no "Invalid Date"
    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });

  // Non-régression : AWAITING_RETURN doit continuer d'afficher une date à l'étape active
  it('should still display a date on the active step when status is AWAITING_RETURN', () => {
    const loan = makeLoan({
      status: 'AWAITING_RETURN',
      confirmationDate: '2024-01-11T10:00:00.000Z',
      returnDate: '2024-02-10T10:00:00.000Z',
      returnedDate: null,
    });

    renderTimeline(loan);

    expect(screen.getByTestId('loan-timeline')).toBeTruthy();
    // At least two dates: createdAt + active period
    const allTexts = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(allTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });
});
