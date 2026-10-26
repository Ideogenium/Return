// =============================================================================
// Shared active loan statuses — single source of truth
// =============================================================================
// Used across modules (Items, Borrowers, Users) to determine if a loan
// is considered "active" (item unavailable, borrower/account cannot be deleted).
// =============================================================================

import { LoanStatus } from '@prisma/client';

/**
 * Statuses where a loan is considered "active" (not yet resolved).
 * An active loan blocks item deletion, borrower deletion, and account deletion.
 */
export const ACTIVE_LOAN_STATUSES: LoanStatus[] = [
  LoanStatus.PENDING_CONFIRMATION,
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
  LoanStatus.AWAITING_RETURN,
];

/**
 * Statuses whose scheduled reminders may still be sent. AWAITING_RETURN must stay:
 * its overdue reminders are what lead the loan to NOT_RETURNED.
 */
export const REMINDABLE_LOAN_STATUSES: LoanStatus[] = [
  LoanStatus.PENDING_CONFIRMATION,
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
  LoanStatus.AWAITING_RETURN,
];

/**
 * Statuses whose return date may change and whose reminders then follow it:
 * not yet overdue, not closed. Also the rule of the planned 409 guard on PATCH.
 */
export const RETURN_DATE_RESCHEDULABLE_STATUSES: LoanStatus[] = [
  LoanStatus.PENDING_CONFIRMATION,
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
];
