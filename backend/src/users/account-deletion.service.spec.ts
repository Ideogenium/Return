import { HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LoanStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
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

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    prisma.$transaction.mockImplementation(((fn: (client: Prisma.TransactionClient) => unknown) =>
      fn(tx)) as never);
    service = new AccountDeletionService(prisma);
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
          email: deletedAccountEmail(USER_ID),
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
      expect(deletedAccountEmail(USER_ID)).toBe(`deleted+${USER_ID}@deleted.invalid`);
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
    ])('detaches his borrowings from his account (%s)', async (_outcome, rows) => {
      givenLenderLoans(rows);

      await service.erase(USER_ID, UNUSABLE_HASH);

      expect(tx.borrower.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { userId: null },
      });
    });

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
