import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ItemCategory, LoanStatus, type User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { ContactInvitationsService } from '../src/contact-invitations/contact-invitations.service';
import { BorrowerLinkingListener } from '../src/borrowers/borrower-linking.listener';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { LOAN_INCLUDE, toLoanResponse } from '../src/common/mappers/loan-response.mapper';
import type { RedisService } from '../src/redis/redis.service';
import type { PhotoStorage } from '../src/storage/interfaces/photo-storage.interface';

// =============================================================================
// FIX-22 (ADR 0010) against a REAL Postgres: the RESTRICT foreign keys behind the
// former 500, the single transaction and the cascades can only be proven on a real
// database. Opt-in: set DB_E2E_DATABASE_URL to a throwaway, migrated database, e.g.
//   docker run -d --rm --name return-db-e2e -e POSTGRES_PASSWORD=pw -e POSTGRES_USER=ret \
//     -e POSTGRES_DB=ret -p 55432:5432 postgres:17
//   DATABASE_URL=postgresql://ret:pw@localhost:55432/ret npx prisma migrate deploy
//   DB_E2E_DATABASE_URL=postgresql://ret:pw@localhost:55432/ret npm run test:e2e -- account-deletion
// Never point it at a database whose data matters: every table is emptied.
// =============================================================================

const DATABASE_URL = process.env['DB_E2E_DATABASE_URL'];
const describeWithDb = DATABASE_URL ? describe : describe.skip;

const PASSWORD = 'StrongPass1!';
const DTO = { password: PASSWORD, confirmationText: 'DELETE MY ACCOUNT' as const };

/** In-memory stand-in for the two Redis calls involved (logout blacklist is not exercised). */
class FakeRedis {
  readonly deleted = new Map<string, number>();
  markAccountDeleted(userId: string, ttlSeconds: number): Promise<void> {
    this.deleted.set(userId, ttlSeconds);
    return Promise.resolve();
  }
  isAccessRevoked(_jti: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.deleted.has(userId));
  }
}

describeWithDb('DELETE /users/me on a real database (FIX-22)', () => {
  let prisma: PrismaService;
  let redis: FakeRedis;
  let purged: string[];
  let users: UsersService;
  let passwordHash: string;

  const config = {
    get: (_key: string, fallback: string) => fallback,
    getOrThrow: () => 'test-secret',
  } as unknown as ConfigService;

  async function createUser(label: string): Promise<User> {
    return prisma.user.create({
      data: {
        email: `${label}-${randomUUID()}@example.com`,
        password: passwordHash,
        firstName: label,
        lastName: 'Test',
        phone: '+33600000000',
        profilePicture: 'https://cdn.example.com/avatar.jpg',
        lastLoginAt: new Date(),
        language: 'en',
      },
    });
  }

  async function createLoan(params: {
    lender: User;
    borrowerUser: User | null;
    status: LoanStatus;
    deletedAt?: Date;
    contestReason?: string;
  }) {
    const item = await prisma.item.create({
      data: {
        name: `Item of ${params.lender.firstName}`,
        description: 'Written by the lender',
        category: ItemCategory.TOOLS,
        userId: params.lender.id,
        photos: { create: { url: 'https://cdn.example.com/p.jpg' } },
      },
    });
    // One contact per (lender, email), as in the app: several loans to Bob share his contact.
    const email = params.borrowerUser?.email ?? `nobody-${randomUUID()}@example.com`;
    const contact = await prisma.borrower.upsert({
      where: { lenderUserId_email: { lenderUserId: params.lender.id, email } },
      update: {},
      create: {
        firstName: 'Alias',
        lastName: 'ByLender',
        email,
        phoneNumber: '+33611111111',
        lenderUserId: params.lender.id,
        userId: params.borrowerUser?.id ?? null,
        trustScore: 80,
      },
    });
    return prisma.loan.create({
      data: {
        itemId: item.id,
        lenderId: params.lender.id,
        borrowerId: contact.id,
        status: params.status,
        notes: 'Notes written by the lender',
        contestReason: params.contestReason ?? null,
        deletedAt: params.deletedAt ?? null,
      },
    });
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = DATABASE_URL;
    prisma = new PrismaService();
    await prisma.$connect();
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE notifications, reminders, loans, photos, items, borrowers, contact_invitations, device_tokens, refresh_tokens, users CASCADE',
    );
    redis = new FakeRedis();
    purged = [];
    const photoStorage = {
      deleteByPrefix: (prefix: string) => {
        purged.push(prefix);
        return Promise.resolve(0);
      },
    } as unknown as PhotoStorage;
    users = new UsersService(
      prisma,
      redis as unknown as RedisService,
      photoStorage,
      new AccountDeletionService(prisma),
      config,
    );
  });

  describe('a lender whose closed loans are still visible to a borrower', () => {
    let lender: User;
    let borrower: User;
    let otherLender: User;
    let keptLoanId: string;
    let contestedLoanId: string;
    let unlinkedLoanId: string;
    let softDeletedLoanId: string;
    let borrowedLoanId: string;

    beforeEach(async () => {
      lender = await createUser('Alice');
      borrower = await createUser('Bob');
      otherLender = await createUser('Carol');

      keptLoanId = (
        await createLoan({ lender, borrowerUser: borrower, status: LoanStatus.RETURNED })
      ).id;
      contestedLoanId = (
        await createLoan({
          lender,
          borrowerUser: borrower,
          status: LoanStatus.CONTESTED,
          contestReason: 'Never received it',
        })
      ).id;
      unlinkedLoanId = (
        await createLoan({ lender, borrowerUser: null, status: LoanStatus.NOT_RETURNED })
      ).id;
      softDeletedLoanId = (
        await createLoan({
          lender,
          borrowerUser: borrower,
          status: LoanStatus.RETURNED,
          deletedAt: new Date(),
        })
      ).id;
      // Alice also borrows from Carol, loan in progress, with her own contest reason.
      borrowedLoanId = (
        await createLoan({
          lender: otherLender,
          borrowerUser: lender,
          status: LoanStatus.ACTIVE,
          contestReason: 'Written by Alice',
        })
      ).id;

      await prisma.notification.createMany({
        data: [
          {
            userId: lender.id,
            type: 'LOAN_CREATED',
            title: 't',
            body: 'own',
            relatedLoanId: keptLoanId,
          },
          {
            userId: borrower.id,
            type: 'LOAN_CREATED',
            title: 't',
            body: 'Alice lent',
            relatedLoanId: keptLoanId,
          },
          {
            userId: otherLender.id,
            type: 'LOAN_CONFIRMED',
            title: 't',
            body: 'Alice confirmed',
            relatedLoanId: borrowedLoanId,
          },
          { userId: borrower.id, type: 'LOAN_CREATED', title: 't', body: 'unrelated' },
        ],
      });
      await prisma.refreshToken.create({
        data: { userId: lender.id, token: randomUUID(), expiresAt: new Date(Date.now() + 1e9) },
      });
      await prisma.deviceToken.create({
        data: { userId: lender.id, token: randomUUID(), platform: 'ios' },
      });
      await prisma.contactInvitation.create({
        data: {
          senderUserId: lender.id,
          recipientUserId: otherLender.id,
          recipientEmail: otherLender.email,
          expiresAt: new Date(Date.now() + 1e9),
        },
      });
    });

    it('no longer fails: the account becomes a pseudonymised tombstone', async () => {
      await expect(users.deleteAccount(lender.id, DTO)).resolves.toBeUndefined();

      const tombstone = await prisma.user.findUniqueOrThrow({ where: { id: lender.id } });
      expect(tombstone).toEqual(
        expect.objectContaining({
          firstName: 'Compte',
          lastName: 'supprimé',
          email: `deleted+${lender.id}@deleted.invalid`,
          phone: null,
          profilePicture: null,
          lastLoginAt: null,
          language: 'fr',
          deletedAt: expect.any(Date),
        }),
      );
      await expect(bcrypt.compare(PASSWORD, tombstone.password)).resolves.toBe(false);
    });

    it('keeps the closed loans the borrower still sees, CONTESTED included, without notes', async () => {
      await users.deleteAccount(lender.id, DTO);

      const loans = await prisma.loan.findMany({
        where: { lenderId: lender.id },
        orderBy: { id: 'asc' },
      });
      expect(loans.map((l) => l.id).sort()).toEqual([keptLoanId, contestedLoanId].sort());
      expect(loans.every((l) => l.notes === null)).toBe(true);
      expect(loans.find((l) => l.id === contestedLoanId)?.contestReason).toBe('Never received it');
      await expect(
        prisma.loan.count({ where: { id: { in: [unlinkedLoanId, softDeletedLoanId] } } }),
      ).resolves.toBe(0);
    });

    it('keeps the kept items without description or photo, and the kept contacts without phone', async () => {
      await users.deleteAccount(lender.id, DTO);

      const items = await prisma.item.findMany({
        where: { userId: lender.id },
        include: { photos: true },
      });
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.description === null && i.photos.length === 0)).toBe(true);

      const contacts = await prisma.borrower.findMany({ where: { lenderUserId: lender.id } });
      expect(contacts).toHaveLength(1);
      expect(contacts.every((c) => c.phoneNumber === null && c.userId === borrower.id)).toBe(true);
      // The borrower's trust score is built from these contacts: it is kept.
      expect(contacts.every((c) => c.trustScore === 80)).toBe(true);
    });

    it('shows the borrower a lender flagged accountDeleted, with the fixed names', async () => {
      await users.deleteAccount(lender.id, DTO);

      const loan = await prisma.loan.findUniqueOrThrow({
        where: { id: keptLoanId },
        include: LOAN_INCLUDE,
      });
      expect(toLoanResponse(loan, borrower.id).lender).toEqual({
        id: lender.id,
        firstName: 'Compte',
        lastName: 'supprimé',
        profilePicture: null,
        accountDeleted: true,
      });
    });

    it('deletes his sessions, push tokens, notifications, invitations and the others notifications naming him', async () => {
      await users.deleteAccount(lender.id, DTO);

      await expect(prisma.refreshToken.count({ where: { userId: lender.id } })).resolves.toBe(0);
      await expect(prisma.deviceToken.count({ where: { userId: lender.id } })).resolves.toBe(0);
      await expect(prisma.contactInvitation.count()).resolves.toBe(0);
      const notifications = await prisma.notification.findMany();
      expect(notifications.map((n) => n.body)).toEqual(['unrelated']);
    });

    it('detaches his borrowings but keeps his contest reason for the other lender', async () => {
      await users.deleteAccount(lender.id, DTO);

      const borrowed = await prisma.loan.findUniqueOrThrow({
        where: { id: borrowedLoanId },
        include: { borrower: true },
      });
      expect(borrowed.borrower.userId).toBeNull();
      expect(borrowed.contestReason).toBe('Written by Alice');
      expect(borrowed.status).toBe(LoanStatus.ACTIVE);
    });

    it('revokes his access tokens and purges his stored photos', async () => {
      await users.deleteAccount(lender.id, DTO);

      const strategy = new JwtStrategy(config, redis as unknown as RedisService);
      await expect(
        strategy.validate({ sub: lender.id, email: lender.email, role: 'LENDER', jti: 'j' }),
      ).rejects.toMatchObject({ status: 401 });
      expect(purged).toEqual([`users/${lender.id}/`]);
    });

    it('frees the address: a new account with it gets back the detached borrowings', async () => {
      const originalEmail = lender.email;
      await users.deleteAccount(lender.id, DTO);

      const reborn = await prisma.user.create({
        data: {
          email: originalEmail,
          password: passwordHash,
          firstName: 'Alice',
          lastName: 'Again',
        },
      });
      await new BorrowerLinkingListener(prisma).handleUserRegistered({
        userId: reborn.id,
        email: originalEmail,
      });

      const borrowed = await prisma.loan.findUniqueOrThrow({
        where: { id: borrowedLoanId },
        include: { borrower: true },
      });
      expect(borrowed.borrower.userId).toBe(reborn.id);
    });

    it('is never found by the contact search', async () => {
      await users.deleteAccount(lender.id, DTO);

      const search = await new ContactInvitationsService(prisma, new EventEmitter2()).searchUsers(
        borrower.id,
        { query: 'Compte' },
      );
      expect(search.data).toHaveLength(0);
    });
  });

  it('reproduces the former 500: a plain user.delete of a lender is refused by RESTRICT (kept as a guard)', async () => {
    const lender = await createUser('Ivy');
    await createLoan({ lender, borrowerUser: null, status: LoanStatus.RETURNED });

    await expect(prisma.user.delete({ where: { id: lender.id } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('deletes the account entirely when no loan remains visible to anyone', async () => {
    const lender = await createUser('Dan');
    await createLoan({ lender, borrowerUser: null, status: LoanStatus.RETURNED });
    await createLoan({
      lender,
      borrowerUser: null,
      status: LoanStatus.ABANDONED,
      deletedAt: new Date(),
    });

    await users.deleteAccount(lender.id, DTO);

    await expect(prisma.user.count({ where: { id: lender.id } })).resolves.toBe(0);
    await expect(prisma.item.count()).resolves.toBe(0);
    await expect(prisma.borrower.count()).resolves.toBe(0);
    expect(redis.deleted.has(lender.id)).toBe(true);
  });

  it('refuses with 409 while a loan is in progress, and changes nothing', async () => {
    const lender = await createUser('Eve');
    const borrower = await createUser('Finn');
    await createLoan({ lender, borrowerUser: borrower, status: LoanStatus.AWAITING_RETURN });

    await expect(users.deleteAccount(lender.id, DTO)).rejects.toMatchObject({ status: 409 });
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: lender.id } });
    expect(unchanged.deletedAt).toBeNull();
    expect(unchanged.firstName).toBe('Eve');
  });

  it('answers 401 for a wrong password even when a loan is in progress', async () => {
    const lender = await createUser('Gus');
    const borrower = await createUser('Hana');
    await createLoan({ lender, borrowerUser: borrower, status: LoanStatus.ACTIVE });

    await expect(
      users.deleteAccount(lender.id, { ...DTO, password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
