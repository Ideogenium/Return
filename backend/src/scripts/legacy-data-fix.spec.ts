import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LoanStatus, ReminderStatus, ReminderType, type PrismaClient } from '@prisma/client';
import { formatReport, parseArgs, runLegacyDataFix, type LegacyFixDb } from './legacy-data-fix.js';

// =============================================================================
// One-off legacy data script — Prisma is mocked: these tests prove the decisions
// (what is selected, what is written, in which transaction), not the SQL.
// =============================================================================

const NOW = new Date('2026-03-10T15:30:00.000Z');
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const LENDER_ID = '550e8400-e29b-41d4-a716-446655440000';

const id = (n: number): string => `110e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;

/** Reminders of a loan due on `returnDate`, as FEAT-11 would have planned them. */
function onTime(returnDate: Date): Array<{ type: ReminderType; scheduledFor: Date }> {
  const day = (offset: number): Date => new Date(returnDate.getTime() + offset * 86_400_000);
  return [
    { type: ReminderType.ON_DUE_DATE, scheduledFor: day(0) },
    { type: ReminderType.FIRST_OVERDUE, scheduledFor: day(7) },
    { type: ReminderType.SECOND_OVERDUE, scheduledFor: day(14) },
    { type: ReminderType.FINAL_OVERDUE, scheduledFor: day(21) },
  ];
}

interface DbState {
  orphans: Array<{ id: string }>;
  /** Open loans having SCHEDULED reminders */
  openWithScheduled: Array<{
    id: string;
    status: LoanStatus;
    returnDate: Date | null;
    reminders: Array<{ type: ReminderType; scheduledFor: Date }>;
  }>;
  toMark: Array<{ id: string }>;
  closeCandidates: Array<Record<string, unknown>>;
  openCount: number;
}

describe('legacy data fix script', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let state: DbState;

  function wire(): void {
    prisma.reminder.findMany.mockImplementation((async () => state.orphans) as never);
    prisma.loan.findMany.mockImplementation((async (args: {
      where: {
        status?: unknown;
        id?: { gt: string };
        reminders?: { some: { status: unknown } };
        returnDate?: unknown;
      };
    }) => {
      if (args.where.status === LoanStatus.AWAITING_RETURN) {
        return state.closeCandidates.filter(
          (loan) => args.where.id === undefined || String(loan.id) > args.where.id.gt,
        );
      }
      if (args.where.reminders) return state.openWithScheduled;
      return state.toMark;
    }) as never);
    prisma.loan.count.mockImplementation((async () => state.openCount) as never);

    // Real behaviour of the writes: orphans disappear, replanned loans get matching reminders.
    prisma.reminder.updateMany.mockImplementation((async (args: { where: { loanId?: string } }) => {
      if (args.where.loanId) return { count: 1 }; // reschedule's own cancellation
      const count = state.orphans.length;
      state.orphans = [];
      return { count };
    }) as never);
    prisma.reminder.createMany.mockImplementation((async (args: {
      data: Array<{ loanId: string }>;
    }) => {
      const loanId = args.data[0].loanId;
      state.openWithScheduled = state.openWithScheduled.filter((loan) => loan.id !== loanId);
      return { count: args.data.length };
    }) as never);
    prisma.loan.findUnique.mockImplementation((async (args: { where: { id: string } }) => {
      const loan = state.openWithScheduled.find((l) => l.id === args.where.id);
      return loan ? { ...loan, deletedAt: null } : null;
    }) as never);
    prisma.$transaction.mockImplementation((async (callback: (tx: unknown) => unknown) =>
      callback(prisma)) as never);
  }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    state = {
      orphans: [],
      openWithScheduled: [],
      toMark: [],
      closeCandidates: [],
      openCount: 0,
    };
    wire();
  });

  function expectNoWrite(): void {
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
    expect(prisma.reminder.createMany).not.toHaveBeenCalled();
    expect(prisma.loan.updateMany).not.toHaveBeenCalled();
    expect(prisma.loan.update).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  }

  const run = (apply: boolean) =>
    runLegacyDataFix(prisma as unknown as LegacyFixDb, { apply, now: NOW });

  describe('parseArgs', () => {
    it('is a dry run by default and applies only with --apply', () => {
      expect(parseArgs([])).toEqual({ apply: false });
      expect(parseArgs(['--apply'])).toEqual({ apply: true });
    });

    it('rejects anything else, so a typo never runs a write by accident', () => {
      expect(() => parseArgs(['--aply'])).toThrow('Unknown argument(s): --aply');
    });
  });

  describe('a. orphan SCHEDULED reminders', () => {
    beforeEach(() => {
      state.orphans = [{ id: id(1) }, { id: id(2) }];
    });

    it('selects SCHEDULED reminders of deleted loans or loans that cannot be reminded anymore', async () => {
      await run(false);

      const { where } = prisma.reminder.findMany.mock.calls[0][0] as {
        where: { status: unknown; loan: { OR: unknown[] } };
      };
      expect(where.status).toBe(ReminderStatus.SCHEDULED);
      expect(where.loan.OR).toEqual([
        { deletedAt: { not: null } },
        {
          status: {
            notIn: [
              LoanStatus.PENDING_CONFIRMATION,
              LoanStatus.ACTIVE,
              LoanStatus.ACTIVE_BY_DEFAULT,
              LoanStatus.AWAITING_RETURN,
            ],
          },
        },
      ]);
    });

    it('dry run: reports the ids and writes nothing', async () => {
      const report = await run(false);

      expect(report.orphanReminderIds).toEqual([id(1), id(2)]);
      expect(report.applied).toBeUndefined();
      expectNoWrite();
    });

    it('--apply: cancels them inside one transaction', async () => {
      const report = await run(true);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: ReminderStatus.SCHEDULED }),
        data: { status: ReminderStatus.CANCELLED },
      });
      expect(report.applied).toEqual({ cancelledReminders: 2, replannedLoans: 0 });
    });
  });

  describe('b. open loans whose reminders do not follow the current returnDate', () => {
    const OLD_DATE = new Date('2026-03-20T00:00:00.000Z');
    const NEW_DATE = new Date('2026-04-05T00:00:00.000Z');

    it('flags a loan whose date changed before FEAT-11, not one already in line', async () => {
      state.openWithScheduled = [
        { id: id(1), status: LoanStatus.ACTIVE, returnDate: NEW_DATE, reminders: onTime(OLD_DATE) },
        {
          id: id(2),
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          returnDate: NEW_DATE,
          reminders: onTime(NEW_DATE),
        },
      ];

      const report = await run(false);

      expect(report.replannedLoanIds).toEqual([id(1)]);
      expectNoWrite();
    });

    it('does not flag a loan whose remaining reminders match, PREVENTIVE included', async () => {
      state.openWithScheduled = [
        {
          id: id(1),
          status: LoanStatus.ACTIVE,
          returnDate: NEW_DATE,
          reminders: [
            ...onTime(NEW_DATE),
            { type: ReminderType.PREVENTIVE, scheduledFor: new Date('2026-04-02T00:00:00.000Z') },
          ],
        },
      ];

      expect((await run(false)).replannedLoanIds).toEqual([]);
    });

    it('flags SCHEDULED reminders left on a loan whose returnDate was removed', async () => {
      state.openWithScheduled = [
        { id: id(1), status: LoanStatus.ACTIVE, returnDate: null, reminders: onTime(OLD_DATE) },
      ];

      expect((await run(false)).replannedLoanIds).toEqual([id(1)]);
    });

    it('--apply: replans like FEAT-11 (lock, cancel scheduled, create from the policy) in the transaction', async () => {
      state.openWithScheduled = [
        { id: id(1), status: LoanStatus.ACTIVE, returnDate: NEW_DATE, reminders: onTime(OLD_DATE) },
      ];

      const report = await run(true);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { loanId: id(1), status: ReminderStatus.SCHEDULED },
        data: { status: ReminderStatus.CANCELLED },
      });
      const created = (
        prisma.reminder.createMany.mock.calls[0][0] as {
          data: Array<{ type: ReminderType; scheduledFor: Date; status: ReminderStatus }>;
        }
      ).data;
      expect(created.map((row) => [row.type, row.scheduledFor.toISOString()])).toEqual([
        [ReminderType.PREVENTIVE, '2026-04-02T00:00:00.000Z'],
        [ReminderType.ON_DUE_DATE, '2026-04-05T00:00:00.000Z'],
        [ReminderType.FIRST_OVERDUE, '2026-04-12T00:00:00.000Z'],
        [ReminderType.SECOND_OVERDUE, '2026-04-19T00:00:00.000Z'],
        [ReminderType.FINAL_OVERDUE, '2026-04-26T00:00:00.000Z'],
      ]);
      expect(created.every((row) => row.status === ReminderStatus.SCHEDULED)).toBe(true);
      expect(report.applied).toEqual({ cancelledReminders: 0, replannedLoans: 1 });
    });

    it('counts a replanned loan that is already past due, as it will get reminders dated in the past', async () => {
      state.openWithScheduled = [
        {
          id: id(1),
          status: LoanStatus.ACTIVE,
          returnDate: new Date('2026-03-01T00:00:00.000Z'),
          reminders: onTime(OLD_DATE),
        },
      ];

      expect((await run(false)).replannedAlreadyOverdueCount).toBe(1);
    });

    it('does not touch AWAITING_RETURN loans (not reschedulable): reports them for manual review', async () => {
      state.openWithScheduled = [
        // due date pushed to the future while already AWAITING_RETURN
        {
          id: id(1),
          status: LoanStatus.AWAITING_RETURN,
          returnDate: NEW_DATE,
          reminders: onTime(OLD_DATE),
        },
        {
          id: id(2),
          status: LoanStatus.AWAITING_RETURN,
          returnDate: new Date('2026-03-01T00:00:00.000Z'),
          reminders: onTime(OLD_DATE),
        },
      ];

      const report = await run(true);

      expect(report.manualReviewLoanIds).toEqual([id(1), id(2)]);
      expect(report.manualReviewFutureDueCount).toBe(1);
      expect(report.replannedLoanIds).toEqual([]);
      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
      expect(report.applied).toEqual({ cancelledReminders: 0, replannedLoans: 0 });
    });

    it('does not count a loan the reschedule skipped (deleted or moved meanwhile)', async () => {
      state.openWithScheduled = [
        { id: id(1), status: LoanStatus.ACTIVE, returnDate: NEW_DATE, reminders: onTime(OLD_DATE) },
      ];
      prisma.loan.findUnique.mockResolvedValue(null);

      const report = await run(true);

      expect(report.applied?.replannedLoans).toBe(0);
      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
    });
  });

  describe('c. CRON counts', () => {
    it('counts what markAwaitingReturn and closeExhausted would do, with the CRON queries, read-only', async () => {
      const finalDue = new Date('2026-02-22T00:00:00.000Z');
      const closable = (loanId: string, returnDate: Date, scheduledFor: Date) => ({
        id: loanId,
        borrowerId: BORROWER_ID,
        lenderId: LENDER_ID,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        returnDate,
        reminders: [{ status: ReminderStatus.SENT, scheduledFor }],
      });
      state.toMark = [{ id: id(1) }, { id: id(2) }];
      state.closeCandidates = [
        // stale: FINAL_OVERDUE sent for the old date, the loan was postponed since
        closable(id(3), new Date('2026-02-11T00:00:00.000Z'), finalDue),
        closable(id(4), new Date('2026-02-01T00:00:00.000Z'), finalDue),
      ];
      state.openCount = 7;

      const report = await run(false);

      expect(report.toMarkAwaitingReturnIds).toEqual([id(1), id(2)]);
      expect(report.toCloseIds).toEqual([id(4)]);
      expect(report.openLoansCount).toBe(7);
      expect(report.wouldTrip).toEqual({ markAwaitingReturn: false, closeExhausted: false });
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT] },
            deletedAt: null,
            returnDate: { not: null, lt: new Date('2026-03-10T00:00:00.000Z') },
          },
        }),
      );
      expectNoWrite();
    });

    it('warns when the CRON circuit breaker would trip with the default settings', async () => {
      state.toMark = Array.from({ length: 101 }, (_, i) => ({ id: id(i) }));
      state.openCount = 150;

      const report = await run(false);

      expect(report.wouldTrip).toEqual({ markAwaitingReturn: true, closeExhausted: false });
      expect(formatReport(report).join('\n')).toContain('markAwaitingReturn WOULD TRIP');
    });

    it('pages through the close candidates until they run out', async () => {
      const row = (n: number) => ({
        id: id(n),
        borrowerId: BORROWER_ID,
        lenderId: LENDER_ID,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        returnDate: new Date('2026-02-01T00:00:00.000Z'),
        reminders: [
          { status: ReminderStatus.FAILED, scheduledFor: new Date('2026-02-22T00:00:00.000Z') },
        ],
      });
      // 205 candidates, page size 200: the second page holds the last 5
      state.closeCandidates = Array.from({ length: 205 }, (_, i) => row(i + 10)).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      prisma.loan.findMany.mockImplementation((async (args: {
        where: { status?: unknown; id?: { gt: string } };
        take?: number;
      }) => {
        if (args.where.status !== LoanStatus.AWAITING_RETURN) return [];
        return state.closeCandidates
          .filter((loan) => args.where.id === undefined || String(loan.id) > args.where.id.gt)
          .slice(0, args.take);
      }) as never);

      expect((await run(false)).toCloseIds).toHaveLength(205);
    });
  });

  describe('idempotence', () => {
    it('--apply a second time finds nothing and writes nothing', async () => {
      state.orphans = [{ id: id(1) }];
      state.openWithScheduled = [
        {
          id: id(2),
          status: LoanStatus.ACTIVE,
          returnDate: new Date('2026-04-05T00:00:00.000Z'),
          reminders: onTime(new Date('2026-03-20T00:00:00.000Z')),
        },
      ];

      const first = await run(true);
      expect(first.applied).toEqual({ cancelledReminders: 1, replannedLoans: 1 });

      prisma.reminder.updateMany.mockClear();
      prisma.reminder.createMany.mockClear();
      prisma.$queryRaw.mockClear();

      const second = await run(true);

      expect(second.orphanReminderIds).toEqual([]);
      expect(second.replannedLoanIds).toEqual([]);
      expect(second.applied).toEqual({ cancelledReminders: 0, replannedLoans: 0 });
      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('a failing write rejects the run, so the transaction is rolled back', async () => {
      state.orphans = [{ id: id(1) }];
      prisma.reminder.updateMany.mockRejectedValue(new Error('boom'));

      await expect(run(true)).rejects.toThrow('boom');
    });
  });

  describe('formatReport', () => {
    it('dry run: counts then UUID lists only', async () => {
      state.orphans = [{ id: id(1) }];
      state.toMark = [{ id: id(2) }];

      const lines = formatReport(await run(false));

      expect(lines[0]).toBe('Legacy data fix — DRY RUN (nothing written)');
      expect(lines).toContain('a. orphan SCHEDULED reminders (closed or deleted loan): 1');
      expect(lines).toContain('c. markAwaitingReturn would move: 1');
      expect(lines).toContain(`  ${id(1)}`);
      expect(lines).toContain(`  ${id(2)}`);
    });

    it('apply: counts and the written totals, without the lists', async () => {
      state.orphans = [{ id: id(1) }];

      const lines = formatReport(await run(true));

      expect(lines[0]).toBe('Legacy data fix — APPLY mode');
      expect(lines).toContain('applied: 1 reminder(s) cancelled, 0 loan(s) replanned');
      expect(lines).not.toContain(`  ${id(1)}`);
    });
  });
});
