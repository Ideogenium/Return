import { LoanStatus } from '@prisma/client';

import {
  LOAN_EVENTS,
  LoanCreatedEvent,
  LoanDeletedEvent,
  LoanReturnDateChangedEvent,
  LoanStatusChangedEvent,
} from '../common/events/loan.events.js';
import { ReminderListener } from './reminder.listener.js';
import { RemindersService } from './reminders.service.js';

describe('ReminderListener', () => {
  let listener: ReminderListener;
  let remindersService: {
    scheduleReminders: jest.Mock;
    cancelScheduled: jest.Mock;
    reschedule: jest.Mock;
  };

  const LOAN_ID = '11111111-1111-1111-1111-111111111111';
  const BORROWER_ID = '22222222-2222-2222-2222-222222222222';
  const LENDER_ID = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    remindersService = {
      scheduleReminders: jest.fn().mockResolvedValue(undefined),
      cancelScheduled: jest.fn().mockResolvedValue(undefined),
      reschedule: jest.fn().mockResolvedValue(undefined),
    };
    listener = new ReminderListener(remindersService as unknown as RemindersService);
  });

  describe(`@OnEvent(${LOAN_EVENTS.CREATED})`, () => {
    const event: LoanCreatedEvent = {
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_ID,
      returnDate: new Date('2026-04-10'),
      createdAt: new Date('2026-03-20'),
    };

    it('should call scheduleReminders with loan data', async () => {
      await listener.handleLoanCreated(event);

      expect(remindersService.scheduleReminders).toHaveBeenCalledWith(
        event.loanId,
        event.returnDate,
        event.createdAt,
      );
    });

    it('should call scheduleReminders even when returnDate is null', async () => {
      const noDateEvent: LoanCreatedEvent = { ...event, returnDate: null };

      await listener.handleLoanCreated(noDateEvent);

      expect(remindersService.scheduleReminders).toHaveBeenCalledWith(
        event.loanId,
        null,
        event.createdAt,
      );
    });
  });

  describe(`@OnEvent(${LOAN_EVENTS.STATUS_CHANGED})`, () => {
    const statusChanged = (
      previousStatus: LoanStatus,
      newStatus: LoanStatus,
    ): LoanStatusChangedEvent => ({
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_ID,
      previousStatus,
      newStatus,
    });

    it.each([
      [LoanStatus.ACTIVE, LoanStatus.RETURNED],
      [LoanStatus.AWAITING_RETURN, LoanStatus.ABANDONED],
      [LoanStatus.PENDING_CONFIRMATION, LoanStatus.CONTESTED],
      [LoanStatus.AWAITING_RETURN, LoanStatus.NOT_RETURNED],
    ])('cancels the scheduled reminders when the loan closes (%s → %s)', async (from, to) => {
      await listener.handleLoanStatusChanged(statusChanged(from, to));

      expect(remindersService.cancelScheduled).toHaveBeenCalledWith(LOAN_ID);
    });

    it.each([
      [LoanStatus.ACTIVE, LoanStatus.AWAITING_RETURN],
      [LoanStatus.ACTIVE_BY_DEFAULT, LoanStatus.AWAITING_RETURN],
      [LoanStatus.PENDING_CONFIRMATION, LoanStatus.ACTIVE],
      [LoanStatus.PENDING_CONFIRMATION, LoanStatus.ACTIVE_BY_DEFAULT],
    ])(
      'keeps the reminders while the loan stays open — the overdue chain relies on them (%s → %s)',
      async (from, to) => {
        await listener.handleLoanStatusChanged(statusChanged(from, to));

        expect(remindersService.cancelScheduled).not.toHaveBeenCalled();
      },
    );
  });

  describe(`@OnEvent(${LOAN_EVENTS.DELETED})`, () => {
    it('cancels the scheduled reminders of a deleted loan', async () => {
      const event: LoanDeletedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        lastStatus: LoanStatus.ACTIVE,
      };

      await listener.handleLoanDeleted(event);

      expect(remindersService.cancelScheduled).toHaveBeenCalledWith(LOAN_ID);
    });
  });

  describe(`@OnEvent(${LOAN_EVENTS.RETURN_DATE_CHANGED})`, () => {
    it('reschedules the reminders from the new return date', async () => {
      const event: LoanReturnDateChangedEvent = {
        loanId: LOAN_ID,
        returnDate: new Date('2026-11-20'),
        changedAt: new Date('2026-10-26T10:00:00Z'),
      };

      await listener.handleReturnDateChanged(event);

      expect(remindersService.reschedule).toHaveBeenCalledWith(
        LOAN_ID,
        event.returnDate,
        event.changedAt,
      );
    });
  });
});
