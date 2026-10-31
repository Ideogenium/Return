import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ConfigService } from '@nestjs/config';
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
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = { emit: jest.fn() };
    exhaustedListener = { closeAsNotReturned: jest.fn().mockResolvedValue(true) };
    // The overdue job is opt-in: tests enable it explicitly, the "disabled" ones override it.
    env = { OVERDUE_JOB_ENABLED: 'true' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ReminderExhaustedListener, useValue: exhaustedListener },
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
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
    // AWAITING_RETURN catch-up candidates (told apart by their status filter). Both
    // honour `take` and the `id > cursor` keyset, like the real queries.
    function mockQueries(
      overdue: Array<{ id: string; status: LoanStatus }>,
      exhausted: Array<string | Record<string, unknown>> = [],
    ): void {
      prisma.loan.findMany.mockImplementation((async (args: {
        where: { status: unknown; id?: { gt: string } };
        take?: number;
      }) => {
        const gt = args.where.id?.gt;
        const page = <T extends { id: unknown }>(rows: T[]): T[] =>
          rows.filter((row) => gt === undefined || String(row.id) > gt).slice(0, args.take);
        if (args.where.status === LoanStatus.AWAITING_RETURN) {
          return page(
            exhausted.map((e) => (typeof e === 'string' ? exhaustedRow(e) : e)) as Array<
              Record<string, unknown> & { id: unknown }
            >,
          );
        }
        return page(
          overdue.map((l) => ({ ...l, borrowerId: BORROWER_ID, lenderId: LENDER_ID })),
        ).slice(0, args.take);
      }) as never);
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T15:30:00.000Z'));
      logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });
      // Default: no volume, so the circuit breaker never trips unless a test says so.
      prisma.loan.count.mockResolvedValue(0);
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

    describe('step isolation', () => {
      let errorSpy: jest.SpyInstance;

      beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      });

      afterEach(() => errorSpy.mockRestore());

      it('still runs step 2, logs the error and flags the tick when step 1 throws', async () => {
        const failure = new Error('db down');
        prisma.loan.findMany.mockImplementation((async (args: { where: { status: unknown } }) => {
          if (args.where.status === LoanStatus.AWAITING_RETURN) return [exhaustedRow(LOAN_ID_3)];
          throw failure;
        }) as never);

        await expect(cronService.handleOverdueLoans()).resolves.toBeUndefined();

        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          'Overdue step markAwaitingReturn failed: db down',
          failure.stack,
        );
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up) — failed: markAwaitingReturn',
        );
      });

      it('keeps the step 1 result, logs the error and flags the tick when step 2 throws', async () => {
        const failure = new Error('db down');
        prisma.loan.findMany.mockImplementation((async (args: { where: { status: unknown } }) => {
          if (args.where.status === LoanStatus.AWAITING_RETURN) throw failure;
          return [
            {
              id: LOAN_ID_1,
              status: LoanStatus.ACTIVE,
              borrowerId: BORROWER_ID,
              lenderId: LENDER_ID,
            },
          ];
        }) as never);

        await expect(cronService.handleOverdueLoans()).resolves.toBeUndefined();

        expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          'Overdue step closeExhausted failed: db down',
          failure.stack,
        );
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 1 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up) — failed: closeExhausted',
        );
      });

      it('lists both steps when both throw', async () => {
        prisma.loan.findMany.mockRejectedValue(new Error('db down'));

        await cronService.handleOverdueLoans();

        expect(errorSpy).toHaveBeenCalledTimes(2);
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up) — failed: markAwaitingReturn, closeExhausted',
        );
      });
    });

    describe('kill switch (OVERDUE_JOB_ENABLED)', () => {
      it.each([undefined, '', 'false', 'TRUE', '1'])(
        'makes no query and logs "skipped" when the value is %p',
        async (value) => {
          env.OVERDUE_JOB_ENABLED = value;

          await cronService.handleOverdueLoans();

          expect(prisma.loan.findMany).not.toHaveBeenCalled();
          expect(prisma.loan.updateMany).not.toHaveBeenCalled();
          expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
          expect(logSpy).toHaveBeenCalledWith(
            "Overdue tick: skipped (OVERDUE_JOB_ENABLED is not 'true')",
          );
        },
      );
    });

    describe('batch (OVERDUE_JOB_BATCH_SIZE)', () => {
      const overdueRows = (n: number): Array<{ id: string; status: LoanStatus }> =>
        Array.from({ length: n }, (_, i) => ({
          id: `loan-${String(i).padStart(3, '0')}`,
          status: LoanStatus.ACTIVE,
        }));

      it('processes at most one batch per step and resumes with the rest at the next pass', async () => {
        env.OVERDUE_JOB_BATCH_SIZE = '2';
        // Like the database: a loan marked at the first pass no longer matches the where.
        let remaining = overdueRows(5);
        let closable = ['c-1', 'c-2', 'c-3'];
        prisma.loan.findMany.mockImplementation((async (args: {
          where: { status: unknown; id?: { gt: string } };
          take: number;
        }) => {
          if (args.where.status === LoanStatus.AWAITING_RETURN) {
            return closable
              .filter((id) => args.where.id === undefined || id > args.where.id.gt)
              .slice(0, args.take)
              .map((id) => exhaustedRow(id));
          }
          return remaining
            .slice(0, args.take)
            .map((l) => ({ ...l, borrowerId: BORROWER_ID, lenderId: LENDER_ID }));
        }) as never);
        prisma.loan.updateMany.mockImplementation((async (args: { where: { id: string } }) => {
          remaining = remaining.filter((l) => l.id !== args.where.id);
          return { count: 1 };
        }) as never);
        exhaustedListener.closeAsNotReturned.mockImplementation(async ({ loanId }) => {
          closable = closable.filter((id) => id !== loanId);
          return true;
        });

        await cronService.handleOverdueLoans();
        expect(logSpy).toHaveBeenLastCalledWith(
          'Overdue tick: 2 loan(s) marked AWAITING_RETURN, 2 closed NOT_RETURNED (catch-up)',
        );
        await cronService.handleOverdueLoans();
        expect(logSpy).toHaveBeenLastCalledWith(
          'Overdue tick: 2 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up)',
        );
        await cronService.handleOverdueLoans();
        expect(logSpy).toHaveBeenLastCalledWith(
          'Overdue tick: 1 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up)',
        );
        expect(remaining).toEqual([]);
        expect(closable).toEqual([]);
      });

      it('reads the overdue loans in a deterministic order, one batch at a time', async () => {
        env.OVERDUE_JOB_BATCH_SIZE = '7';
        mockQueries([]);

        await cronService.handleOverdueLoans();

        expect(prisma.loan.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ returnDate: 'asc' }, { id: 'asc' }],
            take: 7,
          }),
        );
      });

      it('is not blocked by stale catch-up candidates (postponed loans) ahead of the real ones', async () => {
        env.OVERDUE_JOB_BATCH_SIZE = '2';
        const postponed = new Date('2026-02-11T00:00:00.000Z'); // FINAL_DUE is for the old date
        const stale = ['a-1', 'a-2', 'a-3', 'a-4', 'a-5'].map((id) =>
          exhaustedRow(id, ReminderStatus.SENT, FINAL_DUE, postponed),
        );
        mockQueries([], [...stale, 'z-1', 'z-2', 'z-3']);

        await cronService.handleOverdueLoans();

        expect(exhaustedListener.closeAsNotReturned.mock.calls.map(([e]) => e.loanId)).toEqual([
          'z-1',
          'z-2',
        ]);
        // First call is step 1; then 3 pages of 2 hold the 5 stale ones and the first real one,
        // and a 4th page (after z-1) provides the second.
        const afterIds = prisma.loan.findMany.mock.calls.map(
          ([args]) => (args as { where: { id?: { gt: string } } }).where.id?.gt,
        );
        expect(afterIds).toEqual([undefined, undefined, 'a-2', 'a-4', 'z-1']);
      });

      it('stops paging as soon as the candidates run out', async () => {
        env.OVERDUE_JOB_BATCH_SIZE = '2';
        const stale = ['a-1', 'a-2', 'a-3'].map((id) =>
          exhaustedRow(id, ReminderStatus.SENT, FINAL_DUE, new Date('2026-02-11T00:00:00.000Z')),
        );
        mockQueries([], [...stale, 'z-1']);

        await cronService.handleOverdueLoans();

        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up)',
        );
      });
    });

    describe('circuit breaker (OVERDUE_JOB_MAX_SHARE)', () => {
      let errorSpy: jest.SpyInstance;

      const overdueRows = (n: number): Array<{ id: string; status: LoanStatus }> =>
        Array.from({ length: n }, (_, i) => ({ id: `loan-${i}`, status: LoanStatus.ACTIVE }));

      /** count() answers by where: open loans, step 1 candidates, step 2 candidates. */
      function mockCounts(counts: { open: number; overdue: number; exhausted: number }): void {
        prisma.loan.count.mockImplementation((async (args: {
          where: { status: unknown; returnDate?: unknown };
        }) => {
          if (args.where.status === LoanStatus.AWAITING_RETURN) return counts.exhausted;
          if (args.where.returnDate) return counts.overdue;
          return counts.open;
        }) as never);
      }

      beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        env.OVERDUE_JOB_BATCH_SIZE = '2';
      });

      afterEach(() => errorSpy.mockRestore());

      it('counts the step candidates (same where as the read) and the open loans', async () => {
        mockQueries([]);

        await cronService.handleOverdueLoans();

        expect(prisma.loan.count).toHaveBeenCalledWith({
          where: {
            status: { in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT] },
            deletedAt: null,
            returnDate: { not: null, lt: new Date('2026-03-10T00:00:00.000Z') },
          },
        });
        expect(prisma.loan.count).toHaveBeenCalledWith({
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
        });
        expect(prisma.loan.count).toHaveBeenCalledWith({
          where: {
            status: {
              in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT, LoanStatus.AWAITING_RETURN],
            },
            deletedAt: null,
          },
        });
      });

      it('does not trip at the share limit (candidates = share x open)', async () => {
        mockCounts({ open: 8, overdue: 4, exhausted: 4 });
        mockQueries(overdueRows(2), ['a', 'b']);

        await cronService.handleOverdueLoans();

        expect(errorSpy).not.toHaveBeenCalled();
        expect(prisma.loan.updateMany).toHaveBeenCalledTimes(2);
        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(2);
      });

      it('does not trip on a small database even at 100% (candidates <= batch size)', async () => {
        mockCounts({ open: 1, overdue: 1, exhausted: 1 });
        mockQueries(overdueRows(1), ['a']);

        await cronService.handleOverdueLoans();

        expect(errorSpy).not.toHaveBeenCalled();
        expect(prisma.loan.updateMany).toHaveBeenCalledTimes(1);
        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(1);
      });

      it('does not trip above the batch size when the share stays low (large legitimate backlog)', async () => {
        mockCounts({ open: 1000, overdue: 300, exhausted: 0 });
        mockQueries(overdueRows(2));

        await cronService.handleOverdueLoans();

        expect(errorSpy).not.toHaveBeenCalled();
        expect(prisma.loan.updateMany).toHaveBeenCalledTimes(2);
      });

      it('writes nothing for step 1 when tripped, still runs step 2, and flags the tick', async () => {
        mockCounts({ open: 10, overdue: 6, exhausted: 1 });
        mockQueries(overdueRows(2), ['a']);

        await cronService.handleOverdueLoans();

        expect(prisma.loan.updateMany).not.toHaveBeenCalled();
        expect(eventEmitter.emit).not.toHaveBeenCalled();
        expect(prisma.loan.findMany).not.toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: [{ returnDate: 'asc' }, { id: 'asc' }] }),
        );
        expect(exhaustedListener.closeAsNotReturned).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          'Overdue step markAwaitingReturn tripped the circuit breaker: 6 candidate(s) out of 10 open loan(s) ' +
            '(60.0%, limit 50.0%), nothing was written. ' +
            'Check the data, then raise OVERDUE_JOB_MAX_SHARE if this volume is legitimate.',
        );
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 1 closed NOT_RETURNED (catch-up) — tripped: markAwaitingReturn',
        );
      });

      it('closes nothing for step 2 when tripped, still runs step 1, and flags the tick', async () => {
        mockCounts({ open: 10, overdue: 1, exhausted: 6 });
        mockQueries(overdueRows(1), ['a', 'b', 'c']);

        await cronService.handleOverdueLoans();

        expect(exhaustedListener.closeAsNotReturned).not.toHaveBeenCalled();
        expect(prisma.loan.updateMany).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Overdue step closeExhausted tripped the circuit breaker: 6 candidate(s) out of 10',
          ),
        );
        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 1 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up) — tripped: closeExhausted',
        );
      });

      it('lists failed and tripped steps separately in the tick line', async () => {
        mockCounts({ open: 10, overdue: 9, exhausted: 1 });
        prisma.loan.findMany.mockRejectedValue(new Error('db down'));

        await cronService.handleOverdueLoans();

        expect(logSpy).toHaveBeenCalledWith(
          'Overdue tick: 0 loan(s) marked AWAITING_RETURN, 0 closed NOT_RETURNED (catch-up) — failed: closeExhausted — tripped: markAwaitingReturn',
        );
      });

      it('honours OVERDUE_JOB_MAX_SHARE', async () => {
        env.OVERDUE_JOB_MAX_SHARE = '0.9';
        mockCounts({ open: 10, overdue: 6, exhausted: 0 });
        mockQueries(overdueRows(2));

        await cronService.handleOverdueLoans();

        expect(errorSpy).not.toHaveBeenCalled();
        expect(prisma.loan.updateMany).toHaveBeenCalledTimes(2);
      });
    });

    describe('invalid settings fall back to the defaults', () => {
      it.each([undefined, '', 'abc', '0', '-5', '1.5'])(
        'uses a batch of 100 when OVERDUE_JOB_BATCH_SIZE is %p',
        async (value) => {
          env.OVERDUE_JOB_BATCH_SIZE = value;
          mockQueries([]);

          await cronService.handleOverdueLoans();

          expect(prisma.loan.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
        },
      );

      it.each([undefined, '', 'abc', '0', '-0.2', '1.5', 'Infinity'])(
        'uses a share of 0.5 when OVERDUE_JOB_MAX_SHARE is %p',
        async (value) => {
          env.OVERDUE_JOB_MAX_SHARE = value;
          const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
          // 101 candidates out of 200 open: 50.5% > the default 50%
          prisma.loan.count.mockImplementation((async (args: {
            where: { returnDate?: unknown };
          }) => (args.where.returnDate ? 101 : 200)) as never);
          mockQueries([]);

          await cronService.handleOverdueLoans();

          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('markAwaitingReturn tripped the circuit breaker'),
          );
          errorSpy.mockRestore();
        },
      );
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
