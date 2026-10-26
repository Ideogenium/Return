import { Logger } from '@nestjs/common';
import { REMINDABLE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { RemindersCronService } from './reminders-cron.service.js';
import { REMINDER_EVENTS } from '../common/events/reminder.events.js';

// =============================================================================
// Fixtures
// =============================================================================

const LOAN_ID = '11111111-1111-1111-1111-111111111111';
const BORROWER_ID = '22222222-2222-2222-2222-222222222222';
const LENDER_ID = '33333333-3333-3333-3333-333333333333';

const NOW = new Date('2026-04-10T12:00:00Z');

function makeReminder(
  overrides: Partial<{
    id: string;
    loanId: string;
    type: ReminderType;
    status: ReminderStatus;
    scheduledFor: Date;
  }> = {},
) {
  return {
    id: 'rem-001',
    loanId: LOAN_ID,
    type: ReminderType.ON_DUE_DATE,
    status: ReminderStatus.SCHEDULED,
    scheduledFor: new Date('2026-04-10T00:00:00Z'),
    sentAt: null,
    message: null,
    channel: 'PUSH',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// =============================================================================
// Test Suite — REM-009 / REM-010 / REM-012 / REM-013
// =============================================================================

describe('RemindersCronService', () => {
  let cronService: RemindersCronService;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: { emit: jest.Mock };
  let notificationsService: { sendReminderNotification: jest.Mock };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = { emit: jest.fn() };
    notificationsService = { sendReminderNotification: jest.fn().mockResolvedValue(undefined) };

    cronService = new RemindersCronService(
      prisma,
      eventEmitter as never,
      notificationsService as never,
    );
  });

  describe('sendScheduledReminders', () => {
    it('logs one tick per run even when nothing is due, so the job is visible in production logs', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      prisma.reminder.findMany.mockResolvedValue([]);

      await cronService.sendScheduledReminders();

      expect(log).toHaveBeenCalledWith('Reminders tick: 0 due');
      log.mockRestore();
    });

    it('should find SCHEDULED reminders where scheduledFor <= now', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await cronService.sendScheduledReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          status: ReminderStatus.SCHEDULED,
          scheduledFor: { lte: expect.any(Date) },
          loan: { deletedAt: null, status: { in: REMINDABLE_LOAN_STATUSES } },
        },
        include: {
          loan: {
            select: {
              id: true,
              borrowerId: true,
              lenderId: true,
              borrower: { select: { userId: true } },
            },
          },
        },
      });
    });

    it('keeps sending reminders of overdue loans, which lead to NOT_RETURNED, and skips closed or deleted loans', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await cronService.sendScheduledReminders();

      const where = prisma.reminder.findMany.mock.calls[0][0]!.where as {
        loan: { deletedAt: null; status: { in: LoanStatus[] } };
      };
      expect(where.loan.deletedAt).toBeNull();
      expect([...where.loan.status.in].sort()).toEqual(
        [
          LoanStatus.PENDING_CONFIRMATION,
          LoanStatus.ACTIVE,
          LoanStatus.ACTIVE_BY_DEFAULT,
          LoanStatus.AWAITING_RETURN,
        ].sort(),
      );
    });

    it('should update reminder status to SENT and set sentAt', async () => {
      const reminder = makeReminder();
      prisma.reminder.findMany.mockResolvedValue([
        {
          ...reminder,
          loan: {
            id: LOAN_ID,
            borrowerId: BORROWER_ID,
            lenderId: LENDER_ID,
            borrower: { userId: null },
          },
        },
      ] as never);

      await cronService.sendScheduledReminders();

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { id: reminder.id, status: ReminderStatus.SCHEDULED },
        data: { status: ReminderStatus.SENT, sentAt: expect.any(Date) },
      });
    });

    it('should call notificationsService.sendReminderNotification for each reminder', async () => {
      const reminder = makeReminder();
      prisma.reminder.findMany.mockResolvedValue([
        {
          ...reminder,
          loan: {
            id: LOAN_ID,
            borrowerId: BORROWER_ID,
            lenderId: LENDER_ID,
            borrower: { userId: 'borrower-user-id' },
          },
        },
      ] as never);

      await cronService.sendScheduledReminders();

      expect(notificationsService.sendReminderNotification).toHaveBeenCalledWith(
        reminder.id,
        LOAN_ID,
        LENDER_ID,
        reminder.type,
        'borrower-user-id',
      );
    });

    it('should do nothing when no scheduled reminders exist', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await cronService.sendScheduledReminders();

      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
      expect(notificationsService.sendReminderNotification).not.toHaveBeenCalled();
    });

    it('should set status to FAILED when notification fails', async () => {
      const reminder = makeReminder();
      prisma.reminder.findMany.mockResolvedValue([
        {
          ...reminder,
          loan: {
            id: LOAN_ID,
            borrowerId: BORROWER_ID,
            lenderId: LENDER_ID,
            borrower: { userId: null },
          },
        },
      ] as never);
      notificationsService.sendReminderNotification.mockRejectedValue(new Error('FCM error'));

      await cronService.sendScheduledReminders();

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { id: reminder.id, status: ReminderStatus.SCHEDULED },
        data: { status: ReminderStatus.FAILED },
      });
    });

    // REM-012 / REM-013 — AllRemindersExhausted event
    it('should emit ALL_EXHAUSTED after sending FINAL_OVERDUE reminder', async () => {
      const finalReminder = makeReminder({ type: ReminderType.FINAL_OVERDUE });
      prisma.reminder.findMany.mockResolvedValue([
        {
          ...finalReminder,
          loan: {
            id: LOAN_ID,
            borrowerId: BORROWER_ID,
            lenderId: LENDER_ID,
            borrower: { userId: null },
          },
        },
      ] as never);

      await cronService.sendScheduledReminders();

      expect(eventEmitter.emit).toHaveBeenCalledWith(REMINDER_EVENTS.ALL_EXHAUSTED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
      });
    });

    it('should NOT emit ALL_EXHAUSTED for non-FINAL_OVERDUE reminders', async () => {
      const reminder = makeReminder({ type: ReminderType.FIRST_OVERDUE });
      prisma.reminder.findMany.mockResolvedValue([
        {
          ...reminder,
          loan: {
            id: LOAN_ID,
            borrowerId: BORROWER_ID,
            lenderId: LENDER_ID,
            borrower: { userId: null },
          },
        },
      ] as never);

      await cronService.sendScheduledReminders();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
