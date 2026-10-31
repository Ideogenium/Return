import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { RemindersService } from './reminders.service.js';
import { ReminderPolicy } from './reminder-policy.js';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new RemindersService(prisma);
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
