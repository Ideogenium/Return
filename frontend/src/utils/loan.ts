import type { Loan, LoanLender, Borrower } from '../types/api.types';

// Returns the other party relative to the current user:
// the lender sees the borrower, the borrower (or anyone else) sees the lender.
export function getContactForUser(
  loan: Loan,
  currentUserId: string | undefined,
): LoanLender | Borrower {
  return loan.lender.id === currentUserId ? loan.borrower : loan.lender;
}

// Display name of a contact. A lender who deleted his account (FIX-22) keeps fixed names in
// French in the API; the app shows a translated label instead.
export function getContactName(contact: LoanLender | Borrower, t: (key: string) => string): string {
  if ('accountDeleted' in contact && contact.accountDeleted) return t('loans.deletedAccount');
  return `${contact.firstName} ${contact.lastName}`;
}

// Second line of a contact for its lender: the email, or a translated label when the account the
// contact represented was deleted (FIX-22): its email is then a placeholder that means nothing.
export function getContactEmailLine(contact: Borrower, t: (key: string) => string): string {
  return contact.accountDeleted ? t('loans.deletedAccount') : contact.email;
}
