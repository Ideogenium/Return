import { getContactForUser } from '../loan';
import type { Loan, UserSummary, Borrower } from '../../types/api.types';

// Minimal valid factories
const makeLender = (id = 'lender-1'): UserSummary => ({
  id,
  firstName: 'Alice',
  lastName: 'Martin',
});

const makeBorrower = (id = 'borrower-1'): Borrower => ({
  id,
  firstName: 'Bob',
  lastName: 'Dupont',
  email: 'bob@example.com',
});

const makeLoan = (lender: UserSummary, borrower: Borrower): Loan => ({
  id: 'loan-1',
  item: {
    id: 'item-1',
    name: 'Perceuse',
    category: 'TOOLS',
    createdAt: '2026-01-01T00:00:00Z',
  },
  lender,
  borrower,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('getContactForUser', () => {
  const lender = makeLender('lender-1');
  const borrower = makeBorrower('borrower-1');
  const loan = makeLoan(lender, borrower);

  it('should return the borrower when currentUserId matches the lender', () => {
    // Arrange
    const currentUserId = 'lender-1';

    // Act
    const result = getContactForUser(loan, currentUserId);

    // Assert
    expect(result).toBe(loan.borrower);
    expect(result.firstName).toBe('Bob');
    expect(result.lastName).toBe('Dupont');
  });

  it('should return the lender when currentUserId matches the borrower', () => {
    // Arrange
    const currentUserId = 'borrower-1';

    // Act
    const result = getContactForUser(loan, currentUserId);

    // Assert
    expect(result).toBe(loan.lender);
    expect(result.firstName).toBe('Alice');
    expect(result.lastName).toBe('Martin');
  });

  it('should return the lender when currentUserId is undefined (fallback)', () => {
    // Arrange — unauthenticated or unknown user: anyone else sees the lender
    const currentUserId = undefined;

    // Act
    const result = getContactForUser(loan, currentUserId);

    // Assert
    expect(result).toBe(loan.lender);
    expect(result.firstName).toBe('Alice');
  });

  it('should return the lender when currentUserId does not match either party (fallback)', () => {
    // Arrange — third-party user not in the loan
    const currentUserId = 'unknown-user-99';

    // Act
    const result = getContactForUser(loan, currentUserId);

    // Assert
    expect(result).toBe(loan.lender);
    expect(result.firstName).toBe('Alice');
  });
});
