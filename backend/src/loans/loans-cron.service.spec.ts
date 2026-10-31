import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoansCronService } from './loans-cron.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';
import { ReminderExhaustedListener } from './reminder-exhausted.listener.js';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const LOAN_ID_1 = '110e8400-e29b-41d4-a716-446655440001';
const LOAN_ID_2 = '110e8400-e29b-41d4-a716-446655440002';
const LOAN_ID_3 = '110e8400-e29b-41d4-a716-446655440003';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function buildLoan(
  id: string,
  ageHours: number,
  deltaDays: number | null,
): { id: string; borrowerId: string; lenderId: string; createdAt: Date; returnDate: Date | null } {
  const createdAt = new Date(Date.now() - ageHours * HOUR);
  return {
    id,
    borrowerId: BORROWER_ID,
    lenderId: LENDER_ID,
    createdAt,
    returnDate: deltaDays === null ? null : new Date(createdAt.getTime() + deltaDays * DAY),
  };
}

// =============================================================================
// Test Suite — LOAN-022 / LOAN-023
// =============================================================================

describe('LoansCronService', () => {
  let cronService: LoansCronService;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: { emit: jest.Mock };
  let exhaustedListener: { closeAsNotReturned: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = { emit: jest.fn() };
    exhaustedListener = { closeAsNotReturned: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ReminderExhaustedListener, useValue: exhaustedListener },
      ],
    }).compile();

    cronService = module.get<LoansCronService>(LoansCronService);
  });

  describe('handlePendingTimeout', () => {
    it('logs one tick per run even when no loan is due, so the job is visible in production logs', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      prisma.loan.findMany.mockResolvedValue([]);

      await cronService.handlePendingTimeout();

      expect(log).toHaveBeenCalledWith('Pending-confirmation tick: 0 loan(s) to auto-confirm');
      log.mockRestore();
    });

    // FIX-05 vol. A: split auto-confirmation threshold by loan duration.
    // Short loans (Δ < 3 days) auto-confirm after 24h; longer loans after 48h.

    it('auto-confirms short loans (Δ<3) after 24h but not long loans (Δ≥3) before 48h', async () => {
      const shortReady = buildLoan(LOAN_ID_1, 25, 2); // Δ=2 → 24h threshold, age 25h → confirm
      const longTooYoung = buildLoan(LOAN_ID_2, 25, 10); // Δ=10 → 48h threshold, age 25h → skip
      const longReady = buildLoan(LOAN_ID_3, 49, 10); // Δ=10 → 48h threshold, age 49h → confirm

      prisma.loan.findMany.mockResolvedValue([shortReady, longTooYoung, longReady] as never);
      prisma.loan.updateMany.mockResolvedValue({ count: 2 });

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [LOAN_ID_1, LOAN_ID_3] } },
        data: {
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          confirmationDate: expect.any(Date),
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID_1,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: LoanStatus.PENDING_CONFIRMATION,
        newStatus: LoanStatus.ACTIVE_BY_DEFAULT,
      });
    });

    it('falls back to the 48h threshold when returnDate is null', async () => {
      const noDateYoung = buildLoan(LOAN_ID_1, 25, null); // no Δ → 48h, age 25h → skip
      const noDateOld = buildLoan(LOAN_ID_2, 49, null); // no Δ → 48h, age 49h → confirm

      prisma.loan.findMany.mockResolvedValue([noDateYoung, noDateOld] as never);
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [LOAN_ID_2] } },
        data: {
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          confirmationDate: expect.any(Date),
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('queries PENDING candidates older than the shortest (24h) threshold', async () => {
      prisma.loan.findMany.mockResolvedValue([]);

      const before = Date.now();
      await cronService.handlePendingTimeout();
      const after = Date.now();

      const call = prisma.loan.findMany.mock.calls[0][0] as {
        where: { status: LoanStatus; createdAt: { lt: Date }; deletedAt: null };
        select: Record<string, boolean>;
      };

      expect(call.where.status).toBe(LoanStatus.PENDING_CONFIRMATION);
      expect(call.where.deletedAt).toBeNull();
      // returnDate & createdAt are needed to compute the per-loan threshold
      expect(call.select).toMatchObject({ createdAt: true, returnDate: true });

      const cutoffTime = call.where.createdAt.lt.getTime();
      const expected24h = 24 * 60 * 60 * 1000;
      expect(before - cutoffTime).toBeGreaterThanOrEqual(expected24h - 1000);
      expect(after - cutoffTime).toBeLessThanOrEqual(expected24h + 1000);
    });

    it('does nothing when no candidates exist', async () => {
      prisma.loan.findMany.mockResolvedValue([]);

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does nothing when candidates exist but none reached its threshold', async () => {
      const longTooYoung = buildLoan(LOAN_ID_1, 30, 10); // 48h threshold, age 30h → skip

      prisma.loan.findMany.mockResolvedValue([longTooYoung] as never);

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // FEAT-10 — handleOverdueLoans: ACTIVE / ACTIVE_BY_DEFAULT → AWAITING_RETURN
  // ===========================================================================

  describe('handleOverdueLoans', () => {
    let logSpy: jest.SpyInstance;

    const RETURN_DATE = new Date('2026-02-01T00:00:00.000Z');
    const FINAL_DUE = new Date('2026-02-22T00:00:00.000Z'); // returnDate + 21 days

    function exhaustedRow(
      id: string,
      status: ReminderStatus = ReminderStatus.SENT,
      scheduledFor: Date = FINAL_DUE,
      returnDate: Date | null = RETURN_DATE,
    ): Record<string, unknown> {
      return {
        id,
        borrowerId: BORROWER_ID,
        lenderId: LENDER_ID,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        returnDate,
        reminders: [{ type: ReminderType.FINAL_OVERDUE, status, scheduledFor }],
      };
    }

    // Mocks the two findMany calls of a tick: overdue candidates, then the
    // AWAITING_RETURN catch-up candidates (told apart by their status filter).
    function mockQueries(
      overdue: Array<{ id: string; status: LoanStatus }>,
      exhausted: Array<string | Record<string, unknown>> = [],
    ): void {
      prisma.loan.findMany.mockImplementation((async (args: { where: { status: unknown } }) => {
        if (args.where.status === LoanStatus.AWAITING_RETURN) {
          return exhausted.map((e) => (typeof e === 'string' ? exhaustedRow(e) : e));
        }
        return overdue.map((l) => ({ ...l, borrowerId: BORROWER_ID, lenderId: LENDER_ID }));
      }) as never);
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T15:30:00.000Z'));
      logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });
    });

    afterEach(() => {
      jest.useRealTimers();
      logSpy.mockRestore();
    });

    it('selects ACTIVE / ACTIVE_BY_DEFAULT, non-deleted loans due strictly before today (UTC)', async () => {
      mockQueries([]);

      await cronService.handleOverdueLoans();

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT] },
            deletedAt: null,
            returnDate: { not: null, lt: new Date('2026-03-10T00:00:00.000Z') },
          },
        }),
      );
    });

    it.each([
      [
        'one millisecond before midnight UTC (still day J)',
        '2026-03-10T23:59:59.999Z',
        '2026-03-10',
      ],
      ['exactly midnight UTC (J+1 begins)', '2026-03-11T00:00:00.000Z', '2026-03-11'],
      ['mid-day', '2026-03-11T12:00:00.000Z', '2026-03-11'],
    ])('computes the UTC day boundary: %s', async (_label, now, expectedDay) => {
      jest.setSystemTime(new Date(now));
      mockQueries([]);

      await cronService.handleOverdueLoans();

      const where = (
        prisma.loan.findMany.mock.calls[0][0] as { where: { returnDate: { lt: Date } } }
      ).where;
      expect(where.returnDate.lt.toISOString()).toBe(`${expectedDay}T00:00:00.000Z`);
    });

    it('moves overdue loans to AWAITING_RETURN guarded by their current status', async () => {
      mockQueries([
        { id: LOAN_ID_1, status: LoanStatus.ACTIVE },
        { id: LOAN_ID_2, status: LoanStatus.ACTIVE_BY_DEFAULT },
      ]);

      await cronService.handleOverdueLoans();

      const today = new Date('2026-03-10T00:00:00.000Z');
      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: {
          id: LOAN_ID_1,
          status: LoanStatus.ACTIVE,
          deletedAt: null,
          returnDate: { lt: today },
        },
        data: { status: LoanStatus.AWAITING_RETURN },
      });
      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: {
          id: LOAN_ID_2,
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          deletedAt: null,
          returnDate: { lt: today },
        },
        data: { status: LoanStatus.AWAITING_RETURN },
      });
    });

    it('re-checks the due date and deletion in the update, so a date postponed (PATCH) after the read is not marked overdue', async () => {
      mockQueries([{ id: LOAN_ID_1, status: LoanStatus.ACTIVE }]);
      // The row no longer matches (returnDate pushed to the future between findMany and updateMany)
      prisma.loan.updateMany.mockResolvedValueOnce({ count: 0 });

      await cronService.handleOverdueLoans();

      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          returnDate: { lt: new Date('2026-03-10T00:00:00.000Z') },
          deletedAt: null,
        }),
        data: { status: LoanStatus.AWAITING_RETURN },
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits one STATUS_CHANGED event per transitioned loan', async () => {
      mockQueries([
        { id: LOAN_ID_1, status: LoanStatus.ACTIVE },
        { id: LOAN_ID_2, status: LoanStatus.ACTIVE_BY_DEFAULT },
      ]);

      await cronService.handleOverdueLoans();

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID_1,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: LoanStatus.ACTIVE,
        newStatus: LoanStatus.AWAITING_RETURN,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID_2,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: LoanStatus.ACTIVE_BY_DEFAULT,
        newStatus: LoanStatus.AWAITING_RETURN,
      });
    });

    it('is idempotent: a loan already moved by a concurrent tick emits no event', async () => {
      mockQueries([{ id: LOAN_ID_1, status: LoanStatus.ACTIVE }]);
      prisma.loan.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });

      await cronService.handleOverdueLoans();
      await cronService.handleOverdueLoans();

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('does nothing and emits nothing when no loan is overdue', async () => {
      mockQueries([]);

      await cronService.handleOverdueLoans();

      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
    });

    it('never cancels reminders (AWAITING_RETURN keeps them running)', async () => {
      mockQueries([{ id: LOAN_ID_1, status: LoanStatus.ACTIVE }]);

      await cronService.handleOverdueLoans();

      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('catches up AWAITING_RETURN loans whose FINAL_OVERDUE reminder was already SENT', async () => {
      mockQueries([], [LOAN_ID_3]);

      await cronService.handleOverdueLoans();

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: LoanStatus.AWAITING_RETURN,
            deletedAt: null,
            reminders: {
              some: {
                type: ReminderType.FINAL_OVERDUE,
                status: { in: [ReminderStatus.SENT, ReminderStatus.FAILED] },
              },
            },
          },
        }),
      );
      expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledWith({
        loanId: LOAN_ID_3,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
      });
    });

    it('closes in the same tick a late ACTIVE loan whose FINAL_OVERDUE was already SENT', async () => {
      mockQueries([{ id: LOAN_ID_1, status: LoanStatus.ACTIVE }], [LOAN_ID_1]);

      await cronService.handleOverdueLoans();

      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 1 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up)',
      );
      // AWAITING_RETURN is written before the closure is attempted
      const updateOrder = prisma.loan.updateMany.mock.invocationCallOrder[0];
      const closeOrder = exhaustedListener.closeAsNotReturned.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(closeOrder);
    });

    it('does not count a catch-up closure that the listener skipped', async () => {
      mockQueries([], [LOAN_ID_3]);
      exhaustedListener.closeAsNotReturned.mockResolvedValue(false);

      await cronService.handleOverdueLoans();

      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up)',
      );
    });

    it('keeps going when one catch-up closure fails', async () => {
      mockQueries([], [LOAN_ID_1, LOAN_ID_2]);
      exhaustedListener.closeAsNotReturned
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce(true);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await cronService.handleOverdueLoans();

      expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up)',
      );
      errorSpy.mockRestore();
    });

    // FEAT-10 catch-up criterion: FINAL_OVERDUE SENT or FAILED, for the current due date.
    it.each([ReminderStatus.SENT, ReminderStatus.FAILED])(
      'closes an AWAITING_RETURN loan whose current FINAL_OVERDUE is %s',
      async (status) => {
        mockQueries([], [exhaustedRow(LOAN_ID_3, status)]);

        await cronService.handleOverdueLoans();

        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledWith({
          loanId: LOAN_ID_3,
          borrowerId: BORROWER_ID,
          lenderUserId: LENDER_ID,
        });
      },
    );

    it('does not close a loan whose FINAL_OVERDUE is still SCHEDULED', async () => {
      mockQueries([], [exhaustedRow(LOAN_ID_3, ReminderStatus.SCHEDULED)]);

      await cronService.handleOverdueLoans();

      expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
    });

    it('does not close a loan whose FINAL_OVERDUE belongs to a previous due date (postponed loan)', async () => {
      // returnDate was pushed back by 10 days: the SENT FINAL_OVERDUE is for the old one
      const postponedReturnDate = new Date('2026-02-11T00:00:00.000Z');
      mockQueries(
        [],
        [exhaustedRow(LOAN_ID_3, ReminderStatus.SENT, FINAL_DUE, postponedReturnDate)],
      );

      await cronService.handleOverdueLoans();

      expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
    });

    it('does not close a loan without returnDate', async () => {
      mockQueries([], [exhaustedRow(LOAN_ID_3, ReminderStatus.SENT, FINAL_DUE, null)]);

      await cronService.handleOverdueLoans();

      expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
    });

    // FIX-B: one failing loan must not abort the tick
    it('keeps marking the following loans when one updateMany fails, and still runs the catch-up and logs', async () => {
      mockQueries(
        [
          { id: LOAN_ID_1, status: LoanStatus.ACTIVE },
          { id: LOAN_ID_2, status: LoanStatus.ACTIVE },
        ],
        [LOAN_ID_3],
      );
      prisma.loan.updateMany
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValue({ count: 1 });
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await expect(cronService.handleOverdueLoans()).resolves.toBeUndefined();

      expect(prisma.loan.updateMany).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 1 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up)',
      );
      errorSpy.mockRestore();
    });

    it('emits the summary line even when a query throws', async () => {
      prisma.loan.findMany.mockRejectedValue(new Error('db down'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await cronService.handleOverdueLoans().catch(() => undefined);

      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up)',
      );
      errorSpy.mockRestore();
    });

    it('logs the team-convention line on every tick, even when there is nothing to do', async () => {
      mockQueries([]);

      await cronService.handleOverdueLoans();

      expect(logSpy).toHaveBeenCalledWith(
        'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up)',
      );
    });
  });
});
