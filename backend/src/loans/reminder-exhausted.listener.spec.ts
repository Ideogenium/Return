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

  describe(`@OnEvent(${REMINDER_EVENTS.ALL_EXHAUSTED})`, () => {
    const event: AllRemindersExhaustedEvent = {
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_USER_ID,
    };

    it('should transition loan to NOT_RETURNED', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        status: LoanStatus.AWAITING_RETURN,
      } as never);

      await listener.handleAllExhausted(event);

      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: LOAN_ID },
        data: { status: LoanStatus.NOT_RETURNED },
      });
    });

    it('should emit LOAN_EVENTS.STATUS_CHANGED after transition', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        status: LoanStatus.AWAITING_RETURN,
      } as never);

      await listener.handleAllExhausted(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.AWAITING_RETURN,
        newStatus: LoanStatus.NOT_RETURNED,
      });
    });

    it('should not transition if loan is not in AWAITING_RETURN status', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        status: LoanStatus.RETURNED,
      } as never);

      await listener.handleAllExhausted(event);

      expect(prisma.loan.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('closeAsNotReturned (shared with the overdue catch-up)', () => {
    const event: AllRemindersExhaustedEvent = {
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_USER_ID,
    };

    it('returns true and transitions an AWAITING_RETURN loan to NOT_RETURNED', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        status: LoanStatus.AWAITING_RETURN,
      } as never);

      const closed = await listener.closeAsNotReturned(event);

      expect(closed).toBe(true);
      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: LOAN_ID },
        data: { status: LoanStatus.NOT_RETURNED },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.AWAITING_RETURN,
        newStatus: LoanStatus.NOT_RETURNED,
      });
    });

    it('returns false and changes nothing when the loan is not AWAITING_RETURN', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        status: LoanStatus.RETURNED,
      } as never);

      const closed = await listener.closeAsNotReturned(event);

      expect(closed).toBe(false);
      expect(prisma.loan.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
