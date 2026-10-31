import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';
import { RemindersService } from './reminders.service.js';
import { ReminderPolicy } from './reminder-policy.js';

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const THIRD_PARTY_USER_ID = '660e8400-e29b-41d4-a716-446655440000';

/** Runs a call expected to throw and returns the ProblemDetails body. */
function problemOf(call: () => unknown): ProblemDetails {
  try {
    call();
  } catch (error) {
    return (error as { getResponse: () => ProblemDetails }).getResponse();
  }
  throw new Error('Expected the call to throw');
}

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new RemindersService(prisma);
  });

  // FIX-28: lender sees the reminders, the borrower (a party) gets 403, a third party gets
  // the same 404 as for a missing resource.
  describe('assertLoanOwnership', () => {
    const LOAN_ID = '11111111-1111-1111-1111-111111111111';
    const REMINDER_ID = 'aaa00000-e29b-41d4-a716-446655440000';
    const loan = { id: LOAN_ID, lenderId: LENDER_USER_ID, borrowerUserId: BORROWER_USER_ID };
    const path = `/v1/loans/${LOAN_ID}/reminders`;

    it('should let the lender through', () => {
      expect(() =>
        service.assertLoanOwnership(loan, LENDER_USER_ID, path, { name: 'Loan', id: LOAN_ID }),
      ).not.toThrow();
    });

    it('should throw 403 for the borrower, who is a party to the loan', () => {
      const problem = problemOf(() =>
        service.assertLoanOwnership(loan, BORROWER_USER_ID, path, { name: 'Loan', id: LOAN_ID }),
      );

      expect(problem.status).toBe(403);
    });

    it('should throw the loan 404 for a third party, identical to a missing loan', async () => {
      prisma.loan.findUnique.mockResolvedValue(null);
      const missing = await service
        .findLoanForReminders(LOAN_ID, path)
        .catch((error: { getResponse: () => ProblemDetails }) => error.getResponse());

      const foreign = problemOf(() =>
        service.assertLoanOwnership(loan, THIRD_PARTY_USER_ID, path, {
          name: 'Loan',
          id: LOAN_ID,
        }),
      );

      expect(foreign.status).toBe(404);
      expect(foreign.type).toBe((missing as ProblemDetails).type);
      expect(foreign.title).toBe((missing as ProblemDetails).title);
      expect(foreign.detail).toBe((missing as ProblemDetails).detail);
    });

    it('should throw the reminder 404 for a third party', () => {
      const problem = problemOf(() =>
        service.assertLoanOwnership(loan, THIRD_PARTY_USER_ID, `/v1/reminders/${REMINDER_ID}`, {
          name: 'Reminder',
          id: REMINDER_ID,
        }),
      );

      expect(problem.status).toBe(404);
      expect(problem.type).toContain('reminder-not-found');
      expect(problem.detail).toContain(REMINDER_ID);
    });
  });

  describe('loan lookups expose the borrower user', () => {
    const LOAN_ID = '11111111-1111-1111-1111-111111111111';

    it('findLoanForReminders should return the borrower userId', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        id: LOAN_ID,
        lenderId: LENDER_USER_ID,
        deletedAt: null,
        borrower: { userId: BORROWER_USER_ID },
      } as never);

      const loan = await service.findLoanForReminders(LOAN_ID, '/p');

      expect(loan).toEqual({
        id: LOAN_ID,
        lenderId: LENDER_USER_ID,
        borrowerUserId: BORROWER_USER_ID,
      });
    });

    it('findById should return the reminder with the loan borrower userId', async () => {
      prisma.reminder.findUnique.mockResolvedValue({
        id: 'r1',
        loanId: LOAN_ID,
        loan: { id: LOAN_ID, lenderId: LENDER_USER_ID, borrower: { userId: BORROWER_USER_ID } },
      } as never);

      const reminder = await service.findById('r1');

      expect(reminder?.loan).toEqual({
        id: LOAN_ID,
        lenderId: LENDER_USER_ID,
        borrowerUserId: BORROWER_USER_ID,
      });
    });

    it('findById should return null for an unknown reminder', async () => {
      prisma.reminder.findUnique.mockResolvedValue(null);

      await expect(service.findById('nope')).resolves.toBeNull();
    });
  });

  describe('scheduleReminders', () => {
    const LOAN_ID = '11111111-1111-1111-1111-111111111111';
    const RETURN_DATE = new Date('2026-04-10');
    const CREATED_AT = new Date('2026-03-20');

    it('should create 5 reminders in the database', async () => {
      await service.scheduleReminders(LOAN_ID, RETURN_DATE, CREATED_AT);

      expect(prisma.reminder.createMany).toHaveBeenCalledTimes(1);
      const call = prisma.reminder.createMany.mock.calls[0][0]!;
      expect((call.data as unknown[]).length).toBe(5);
    });

    it('should pass correct types and scheduledFor dates from ReminderPolicy', async () => {
      const expectedDates = ReminderPolicy.calculateDates(RETURN_DATE, CREATED_AT);

      await service.scheduleReminders(LOAN_ID, RETURN_DATE, CREATED_AT);

      const call = prisma.reminder.createMany.mock.calls[0][0]!;
      const data = call.data as Array<{
        loanId: string;
        type: ReminderType;
        status: ReminderStatus;
        scheduledFor: Date;
      }>;

      for (let i = 0; i < expectedDates.length; i++) {
        expect(data[i]).toEqual({
          loanId: LOAN_ID,
          type: expectedDates[i].type,
          status: ReminderStatus.SCHEDULED,
          scheduledFor: expectedDates[i].scheduledFor,
        });
      }
    });

    it('should not create any reminders when returnDate is null', async () => {
      await service.scheduleReminders(LOAN_ID, null, CREATED_AT);

      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
    });
  });

  describe('cancelScheduled', () => {
    const LOAN_ID = '11111111-1111-1111-1111-111111111111';

    it('cancels only the still-scheduled reminders of the loan, keeping sent ones as history', async () => {
      prisma.reminder.updateMany.mockResolvedValue({ count: 3 });

      await service.cancelScheduled(LOAN_ID);

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { loanId: LOAN_ID, status: ReminderStatus.SCHEDULED },
        data: { status: ReminderStatus.CANCELLED },
      });
    });
  });

  describe('reschedule', () => {
    const LOAN_ID = '11111111-1111-1111-1111-111111111111';
    const NOW = new Date('2026-10-26T10:00:00Z');

    const loanInDb = (loan: {
      returnDate: Date | null;
      status: LoanStatus;
      deletedAt?: Date | null;
    }) => {
      prisma.loan.findUnique.mockResolvedValue({ deletedAt: null, ...loan } as never);
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(((run: (tx: PrismaService) => Promise<unknown>) =>
        run(prisma)) as never);
      prisma.reminder.updateMany.mockResolvedValue({ count: 2 });
    });

    it('replaces the scheduled reminders with the policy computed from the return date stored on the loan', async () => {
      loanInDb({ returnDate: new Date('2026-11-20'), status: LoanStatus.ACTIVE });

      await service.reschedule(LOAN_ID, NOW);

      expect(prisma.loan.findUnique).toHaveBeenCalledWith({
        where: { id: LOAN_ID },
        select: { returnDate: true, status: true, deletedAt: true },
      });
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { loanId: LOAN_ID, status: ReminderStatus.SCHEDULED },
        data: { status: ReminderStatus.CANCELLED },
      });
      const data = prisma.reminder.createMany.mock.calls[0][0]!.data as Array<{
        type: ReminderType;
        scheduledFor: Date;
      }>;
      expect(data.map((r) => [r.type, r.scheduledFor.toISOString().slice(0, 10)])).toEqual([
        [ReminderType.PREVENTIVE, '2026-11-17'],
        [ReminderType.ON_DUE_DATE, '2026-11-20'],
        [ReminderType.FIRST_OVERDUE, '2026-11-27'],
        [ReminderType.SECOND_OVERDUE, '2026-12-04'],
        [ReminderType.FINAL_OVERDUE, '2026-12-11'],
      ]);
    });

    it('runs the read, the cancellation and the creation in one transaction', async () => {
      loanInDb({ returnDate: new Date('2026-11-20'), status: LoanStatus.ACTIVE });

      await service.reschedule(LOAN_ID, NOW);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toBeInstanceOf(Function);
    });

    // Two concurrent PATCH of the return date: without a lock, each transaction cancels only
    // the reminders it can see, then both create theirs — the loan ends up with duplicates.
    it('locks the loan row before reading it, so concurrent reschedules run one after the other', async () => {
      loanInDb({ returnDate: new Date('2026-11-20'), status: LoanStatus.ACTIVE });

      await service.reschedule(LOAN_ID, NOW);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [sql, id] = prisma.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
      expect(sql.join('?')).toMatch(/SELECT .* FROM "loans" WHERE "id" = \?::uuid FOR UPDATE/s);
      expect(id).toBe(LOAN_ID);
      const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(prisma.loan.findUnique.mock.invocationCallOrder[0]);
      expect(lockOrder).toBeLessThan(prisma.reminder.updateMany.mock.invocationCallOrder[0]);
    });

    it('only cancels when the loan no longer has a return date', async () => {
      loanInDb({ returnDate: null, status: LoanStatus.ACTIVE });

      await service.reschedule(LOAN_ID, NOW);

      expect(prisma.reminder.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
    });

    it.each([
      LoanStatus.AWAITING_RETURN,
      LoanStatus.RETURNED,
      LoanStatus.ABANDONED,
      LoanStatus.CONTESTED,
      LoanStatus.NOT_RETURNED,
    ])(
      'changes nothing when the loan is %s by the time the event is handled (overdue chain or closed loan)',
      async (status) => {
        loanInDb({ returnDate: new Date('2026-11-20'), status });

        await service.reschedule(LOAN_ID, NOW);

        expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
        expect(prisma.reminder.createMany).not.toHaveBeenCalled();
      },
    );

    it('changes nothing for a deleted or missing loan', async () => {
      loanInDb({ returnDate: new Date('2026-11-20'), status: LoanStatus.ACTIVE, deletedAt: NOW });
      await service.reschedule(LOAN_ID, NOW);
      prisma.loan.findUnique.mockResolvedValue(null);
      await service.reschedule(LOAN_ID, NOW);

      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
      expect(prisma.reminder.createMany).not.toHaveBeenCalled();
    });
  });
});
