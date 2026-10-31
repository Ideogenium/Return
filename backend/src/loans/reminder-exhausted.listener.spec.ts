import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoanStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { ReminderExhaustedListener } from './reminder-exhausted.listener.js';
import { REMINDER_EVENTS, AllRemindersExhaustedEvent } from '../common/events/reminder.events.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';

// =============================================================================
// Fixtures
// =============================================================================

const LOAN_ID = '11111111-1111-1111-1111-111111111111';
const BORROWER_ID = '22222222-2222-2222-2222-222222222222';
const LENDER_USER_ID = '33333333-3333-3333-3333-333333333333';

// =============================================================================
// Test Suite
// =============================================================================

describe('ReminderExhaustedListener', () => {
  let listener: ReminderExhaustedListener;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = { emit: jest.fn() };
    listener = new ReminderExhaustedListener(prisma, eventEmitter as never);
  });

  const event: AllRemindersExhaustedEvent = {
    loanId: LOAN_ID,
    borrowerId: BORROWER_ID,
    lenderUserId: LENDER_USER_ID,
  };

  const guardedWrite = {
    where: { id: LOAN_ID, status: LoanStatus.AWAITING_RETURN, deletedAt: null },
    data: { status: LoanStatus.NOT_RETURNED },
  };

  describe(`@OnEvent(${REMINDER_EVENTS.ALL_EXHAUSTED})`, () => {
    it('should transition loan to NOT_RETURNED with a guarded write', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      await listener.handleAllExhausted(event);

      expect(prisma.loan.updateMany).toHaveBeenCalledWith(guardedWrite);
      expect(prisma.loan.update).not.toHaveBeenCalled();
    });

    it('should emit LOAN_EVENTS.STATUS_CHANGED after transition', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      await listener.handleAllExhausted(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.AWAITING_RETURN,
        newStatus: LoanStatus.NOT_RETURNED,
      });
    });

    it('should not emit if the loan is no longer AWAITING_RETURN', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });

      await listener.handleAllExhausted(event);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('closeAsNotReturned (shared with the overdue catch-up)', () => {
    it('returns true and transitions an AWAITING_RETURN loan to NOT_RETURNED', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      const closed = await listener.closeAsNotReturned(event);

      expect(closed).toBe(true);
      expect(prisma.loan.updateMany).toHaveBeenCalledWith(guardedWrite);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.AWAITING_RETURN,
        newStatus: LoanStatus.NOT_RETURNED,
      });
    });

    // Loan already RETURNED by the lender, soft-deleted, unknown, or closed by a
    // concurrent tick: the guarded write matches no row.
    it('returns false and emits nothing when the guarded write matches no row (count = 0)', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });

      const closed = await listener.closeAsNotReturned(event);

      expect(closed).toBe(false);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('returns false when the loan does not exist', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });

      await expect(listener.closeAsNotReturned({ ...event, loanId: 'missing-loan' })).resolves.toBe(
        false,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('never writes a soft-deleted or non AWAITING_RETURN loan (guard in the where)', async () => {
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });

      await listener.closeAsNotReturned(event);

      const { where } = prisma.loan.updateMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(where).toMatchObject({ status: LoanStatus.AWAITING_RETURN, deletedAt: null });
    });
  });
});
