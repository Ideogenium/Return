import { HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LoanStatus, type Prisma } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import {
  AccountDeletionService,
  DELETED_ACCOUNT_FIRST_NAME,
  DELETED_ACCOUNT_LAST_NAME,
  deletedAccountEmail,
} from './account-deletion.service.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const UNUSABLE_HASH = '$2b$12$unusable';

type LenderLoanRow = {
  id: string;
  status: LoanStatus;
  deletedAt: Date | null;
  itemId: string;
  borrowerId: string;
  borrower: { userId: string | null };
};

const loanRow = (overrides: Partial<LenderLoanRow> & { id: string }): LenderLoanRow => ({
  status: LoanStatus.RETURNED,
  deletedAt: null,
  itemId: `item-of-${overrides.id}`,
  borrowerId: `contact-of-${overrides.id}`,
  borrower: { userId: 'borrower-user' },
  ...overrides,
});

describe('AccountDeletionService.erase (FIX-22, ADR 0010)', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let service: AccountDeletionService;

  /** Loans where the account is the lender, as returned by the first query of the transaction. */
  function givenLenderLoans(rows: LenderLoanRow[], borrowedLoanIds: string[] = []): void {
    tx.loan.findMany.mockImplementation(((args: Prisma.LoanFindManyArgs) =>
      Promise.resolve(
        args.where?.lenderId === USER_ID ? rows : borrowedLoanIds.map((id) => ({ id })),
      )) as never);
  }

  let redis: { markAccountDeleted: jest.Mock };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    prisma.$transaction.mockImplementation(((fn: (client: Prisma.TransactionClient) => unknown) =>
      fn(tx)) as never);
    // The account row is found and locked.
    tx.$queryRaw.mockResolvedValue([{ id: USER_ID }] as never);
    tx.borrower.findMany.mockResolvedValue([]);
    redis = { markAccountDeleted: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as unknown as ConfigService;
    service = new AccountDeletionService(prisma, redis as unknown as RedisService, config);
  });

  describe('transaction guards (security review C1, C2, C3)', () => {
    it('runs in one transaction with bounded wait and duration', async () => {
      givenLenderLoans([]);

      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 30_000,
        maxWait: 5_000,
      });
    });

    it('locks the live account row first, so a concurrent loan creation waits', async () => {
      givenLenderLoans([]);

      await service.erase(USER_ID, UNUSABLE_HASH);

      const [sql] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
      expect(sql.join('?')).toMatch(/FOR UPDATE/);
      expect(sql.join('?')).toMatch(/deleted_at IS NULL/);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.loan.findMany.mock.invocationCallOrder[0],
      );
    });

    it('answers 404 when the account is already deleted (double tap)', async () => {
      tx.$queryRaw.mockResolvedValue([] as never);

      const error = (await service.erase(USER_ID, UNUSABLE_HASH).catch((e: unknown) => e)) as {
        getStatus: () => number;
        getResponse: () => ProblemDetails;
      };

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getResponse().type).toContain('user-not-found');
      expect(tx.loan.findMany).not.toHaveBeenCalled();
    });

    it.each(['deleted', 'pseudonymised'] as const)(
      'marks the account deleted in Redis as the last step inside the transaction (%s)',
      async (outcome) => {
        givenLenderLoans(outcome === 'deleted' ? [] : [loanRow({ id: 'kept' })]);

        await service.erase(USER_ID, UNUSABLE_HASH);

        expect(redis.markAccountDeleted).toHaveBeenCalledWith(USER_ID, 900);
        const lastWrite = Math.max(
          ...tx.user.delete.mock.invocationCallOrder,
          ...tx.user.update.mock.invocationCallOrder,
        );
        expect(redis.markAccountDeleted.mock.invocationCallOrder[0]).toBeGreaterThan(lastWrite);
      },
    );

    it('answers 503 when Redis cannot be written, so the transaction rolls back', async () => {
      givenLenderLoans([loanRow({ id: 'kept' })]);
      redis.markAccountDeleted.mockRejectedValue(new Error('Redis down'));

      const error = (await service.erase(USER_ID, UNUSABLE_HASH).catch((e: unknown) => e)) as {
        getStatus: () => number;
        getResponse: () => ProblemDetails;
      };

      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.getResponse().type).toContain('service-unavailable');
    });

    it.each(['P2003', 'P2002'])(
      'turns a constraint error raised by a concurrent write (%s) into 409 active-loans-exist',
      async (code) => {
        prisma.$transaction.mockRejectedValue(Object.assign(new Error('constraint'), { code }));

        const error = (await service.erase(USER_ID, UNUSABLE_HASH).catch((e: unknown) => e)) as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };

        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(error.getResponse().type).toContain('active-loans-exist');
      },
    );

    it('never keeps a loan to himself (review S6)', async () => {
      givenLenderLoans([loanRow({ id: 'self', borrower: { userId: USER_ID } })]);

      await expect(service.erase(USER_ID, UNUSABLE_HASH)).resolves.toBe('deleted');
      expect(tx.loan.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['self'] } } });
    });
  });

  it('re-checks the in-progress loans inside the transaction and refuses with 409', async () => {
    givenLenderLoans([loanRow({ id: 'l1', status: LoanStatus.ACTIVE })]);

    const error = (await service.erase(USER_ID, UNUSABLE_HASH).catch((e: unknown) => e)) as {
      getStatus: () => number;
      getResponse: () => ProblemDetails;
    };

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse().type).toContain('active-loans-exist');
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('ignores a soft-deleted in-progress loan: it is dropped, not blocking', async () => {
    givenLenderLoans([loanRow({ id: 'l1', status: LoanStatus.ACTIVE, deletedAt: new Date() })]);

    await expect(service.erase(USER_ID, UNUSABLE_HASH)).resolves.toBe('deleted');
    expect(tx.loan.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['l1'] } } });
  });

  describe('when no loan has to be kept', () => {
    it('drops the soft-deleted loans and the closed loans nobody can see, then deletes the user', async () => {
      givenLenderLoans([
        loanRow({ id: 'soft', deletedAt: new Date() }),
        loanRow({ id: 'unlinked', borrower: { userId: null } }),
      ]);

      await expect(service.erase(USER_ID, UNUSABLE_HASH)).resolves.toBe('deleted');

      expect(tx.loan.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['soft', 'unlinked'] } },
      });
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.loan.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.delete.mock.invocationCallOrder[0],
      );
    });

    it('also deletes an account that never lent anything', async () => {
      givenLenderLoans([]);

      await expect(service.erase(USER_ID, UNUSABLE_HASH)).resolves.toBe('deleted');
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    });
  });

  describe('when a closed loan is still visible to a borrower (tombstone)', () => {
    beforeEach(() => {
      givenLenderLoans([
        loanRow({ id: 'kept', itemId: 'kept-item', borrowerId: 'kept-contact' }),
        loanRow({ id: 'contested', status: LoanStatus.CONTESTED, itemId: 'i2', borrowerId: 'c2' }),
        loanRow({ id: 'soft', deletedAt: new Date() }),
      ]);
    });

    it('keeps every closed loan, CONTESTED included, and drops only the others', async () => {
      await expect(service.erase(USER_ID, UNUSABLE_HASH)).resolves.toBe('pseudonymised');

      expect(tx.loan.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['soft'] } } });
      expect(tx.user.delete).not.toHaveBeenCalled();
    });

    it('pseudonymises the account row and marks it deleted', async () => {
      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: expect.objectContaining({
          firstName: DELETED_ACCOUNT_FIRST_NAME,
          lastName: DELETED_ACCOUNT_LAST_NAME,
          email: expect.stringMatching(
            new RegExp(`^deleted\\+${USER_ID}\\.[0-9a-f]{16}@deleted\\.invalid$`),
          ),
          password: UNUSABLE_HASH,
          phone: null,
          profilePicture: null,
          lastLoginAt: null,
          pushNotificationsEnabled: true,
          reminderEnabled: true,
          language: 'fr',
          timezone: 'Europe/Paris',
          deletedAt: expect.any(Date),
        }),
      });
      expect(DELETED_ACCOUNT_FIRST_NAME).toBe('Compte');
      expect(DELETED_ACCOUNT_LAST_NAME).toBe('supprimé');
      // A random part makes the address impossible to guess and take first (security review B1).
      expect(deletedAccountEmail(USER_ID, 'a1b2')).toBe(`deleted+${USER_ID}.a1b2@deleted.invalid`);
      const emails = tx.user.update.mock.calls.map(([args]) => args.data.email);
      expect(new Set(emails).size).toBe(emails.length);
    });

    it('empties the free texts he wrote: loan notes and item descriptions', async () => {
      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.loan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['kept', 'contested'] } },
        data: { notes: null },
      });
      expect(tx.item.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['kept-item', 'i2'] } },
        data: { description: null },
      });
    });

    it('keeps the items and contacts of the kept loans only, without photo or phone', async () => {
      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.photo.deleteMany).toHaveBeenCalledWith({ where: { item: { userId: USER_ID } } });
      expect(tx.item.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, id: { notIn: ['kept-item', 'i2'] } },
      });
      expect(tx.borrower.deleteMany).toHaveBeenCalledWith({
        where: { lenderUserId: USER_ID, id: { notIn: ['kept-contact', 'c2'] } },
      });
      expect(tx.borrower.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['kept-contact', 'c2'] } },
        data: { phoneNumber: null },
      });
    });

    it('deletes his sessions, push tokens, notifications and invitations', async () => {
      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(tx.contactInvitation.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ senderUserId: USER_ID }, { recipientUserId: USER_ID }] },
      });
    });
  });

  describe('in both outcomes', () => {
    it.each([
      ['deleted', []],
      ['pseudonymised', [loanRow({ id: 'kept' })]],
    ])(
      'detaches his borrowings for good: email and phone erased, never relinked (%s, review C4)',
      async (_outcome, rows) => {
        givenLenderLoans(rows);
        tx.borrower.findMany.mockResolvedValue([{ id: 'contact-at-carol' }] as never);

        await service.erase(USER_ID, UNUSABLE_HASH);

        expect(tx.borrower.findMany).toHaveBeenCalledWith({
          where: { userId: USER_ID },
          select: { id: true },
        });
        expect(tx.borrower.update).toHaveBeenCalledWith({
          where: { id: 'contact-at-carol' },
          data: {
            userId: null,
            email: expect.stringMatching(
              /^deleted\+contact-at-carol\.[0-9a-f]{16}@deleted\.invalid$/,
            ),
            phoneNumber: null,
            accountDeletedAt: expect.any(Date),
          },
        });
      },
    );

    it("deletes the other users' loan notifications that name him, before any loan is dropped", async () => {
      givenLenderLoans(
        [loanRow({ id: 'kept' }), loanRow({ id: 'soft', deletedAt: new Date() })],
        ['borrowed'],
      );

      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: { not: USER_ID }, relatedLoanId: { in: ['kept', 'soft', 'borrowed'] } },
      });
      const othersCall = tx.notification.deleteMany.mock.calls.findIndex(
        ([args]) => (args?.where?.userId as { not?: string } | undefined)?.not === USER_ID,
      );
      expect(tx.notification.deleteMany.mock.invocationCallOrder[othersCall]).toBeLessThan(
        tx.loan.deleteMany.mock.invocationCallOrder[0],
      );
    });

    it.each([
      ['deleted', []],
      ['pseudonymised', [loanRow({ id: 'kept' })]],
    ])(
      "deletes the other users' invitation notifications naming him, by actorUserId (%s)",
      async (_outcome, rows) => {
        givenLenderLoans(rows);

        await service.erase(USER_ID, UNUSABLE_HASH);

        expect(tx.notification.deleteMany).toHaveBeenCalledWith({
          where: { actorUserId: USER_ID },
        });
      },
    );
  });
});
