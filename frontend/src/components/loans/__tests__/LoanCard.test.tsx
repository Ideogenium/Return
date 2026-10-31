import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { LoanCard } from '../LoanCard';
import { useAuthStore } from '../../../stores/useAuthStore';
import type { Loan, User, UserSummary, Borrower } from '../../../types/api.types';

// --- Factories ---

function makeUser(id: string, firstName: string, lastName: string): User {
  return {
    id,
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName,
    role: 'LENDER',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeLender(id: string, firstName: string, lastName: string): UserSummary {
  return { id, firstName, lastName };
}

function makeBorrower(id: string, firstName: string, lastName: string): Borrower {
  return {
    id,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}@example.com`,
  };
}

function makeLoan(lender: UserSummary, borrower: Borrower): Loan {
  return {
    id: 'loan-42',
    item: {
      id: 'item-1',
      name: 'Perceuse Bosch',
      category: 'TOOLS',
      createdAt: '2026-01-01T00:00:00Z',
    },
    lender,
    borrower,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// --- Helper render ---

function renderLoanCard(loan: Loan) {
  return render(
    <PaperProvider>
      <LoanCard loan={loan} onPress={jest.fn()} />
    </PaperProvider>,
  );
}

// --- Setup / teardown ---

afterEach(() => {
  useAuthStore.getState().reset();
});

// --- Tests ---

describe('LoanCard — contact field relative to current user (FIX-11)', () => {
  it('should display the borrower name when current user is the lender', () => {
    // Arrange — lender = Alice Martin, borrower = Bob Dupont
    const lender = makeLender('user-alice', 'Alice', 'Martin');
    const borrower = makeBorrower('user-bob', 'Bob', 'Dupont');
    const loan = makeLoan(lender, borrower);

    useAuthStore.setState({ user: makeUser('user-alice', 'Alice', 'Martin') });

    // Act
    renderLoanCard(loan);

    // Assert — borrower name visible, lender name absent from contact line
    expect(screen.getByText(/Bob Dupont/)).toBeTruthy();
    expect(screen.queryByText(/Alice Martin/)).toBeNull();
  });

  it('should display the lender name when current user is the borrower', () => {
    // Arrange — lender = Alice Martin, borrower = Bob Dupont
    const lender = makeLender('user-alice', 'Alice', 'Martin');
    const borrower = makeBorrower('user-bob', 'Bob', 'Dupont');
    const loan = makeLoan(lender, borrower);

    useAuthStore.setState({ user: makeUser('user-bob', 'Bob', 'Dupont') });

    // Act
    renderLoanCard(loan);

    // Assert — lender name visible, borrower name absent from contact line
    expect(screen.getByText(/Alice Martin/)).toBeTruthy();
    expect(screen.queryByText(/Bob Dupont/)).toBeNull();
  });
});
