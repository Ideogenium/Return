import type { Loan, UserSummary, Borrower } from '../types/api.types';

// Returns the other party relative to the current user:
// the lender sees the borrower, the borrower (or anyone else) sees the lender.
export function getContactForUser(
  loan: Loan,
  currentUserId: string | undefined,
): UserSummary | Borrower {
  return loan.lender.id === currentUserId ? loan.borrower : loan.lender;
}
