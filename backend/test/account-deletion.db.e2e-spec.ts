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
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { LoansService } from '../src/loans/loans.service';
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
  /** Makes the next writes fail, as a Redis outage would (security review C1). */
  failWrites = false;
  markAccountDeleted(userId: string, ttlSeconds: number): Promise<void> {
    if (this.failWrites) return Promise.reject(new Error('Redis down'));
    this.deleted.set(userId, ttlSeconds);
    return Promise.resolve();
  }
  isAccessRevoked(_jti: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.deleted.has(userId));
  }
  /** Daily loan counter used by LoansService: always below the limit here. */
  getClient() {
    return {
      get: () => Promise.resolve(null),
      incr: () => Promise.resolve(1),
      expire: () => Promise.resolve(1),
    };
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
      new AccountDeletionService(prisma, redis as unknown as RedisService, config),
    );
  });

  function loansService(): LoansService {
    const events = new EventEmitter2();
    return new LoansService(
      prisma,
      redis as unknown as RedisService,
      events,
      new ContactInvitationsService(prisma, events),
    );
  }

  function authService(): AuthService {
    return new AuthService(
      prisma,
      new JwtService({ secret: 'test-secret' }),
      config,
      redis as unknown as RedisService,
      new EventEmitter2(),
    );
  }

  /** A lender with an accepted contact, ready to lend (no loan yet). */
  async function lenderWithAcceptedContact(label: string) {
    const lender = await createUser(label);
    const friend = await createUser(`${label}Friend`);
    const contact = await prisma.borrower.create({
      data: {
        firstName: 'Friend',
        lastName: 'OfLender',
        email: friend.email,
        lenderUserId: lender.id,
        userId: friend.id,
      },
    });
    await prisma.contactInvitation.create({
      data: {
        senderUserId: lender.id,
        recipientUserId: friend.id,
        recipientEmail: friend.email,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 1e9),
      },
    });
    return { lender, friend, contact };
  }

  function newLoanDto(contactId: string) {
    return {
      item: { name: 'Raced item', category: ItemCategory.TOOLS },
      borrowerId: contactId,
      returnDate: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
    };
  }

  describe('security review (C1, C2, C4)', () => {
    it('erases nothing when Redis cannot record the revocation: 503 and a full rollback', async () => {
      const { lender, contact } = await lenderWithAcceptedContact('Nora');
      await createLoan({
        lender,
        borrowerUser: await createUser('Olga'),
        status: LoanStatus.RETURNED,
      });
      const before = {
        loans: await prisma.loan.count(),
        items: await prisma.item.count(),
        contacts: await prisma.borrower.count(),
        invitations: await prisma.contactInvitation.count(),
      };
      redis.failWrites = true;

      await expect(users.deleteAccount(lender.id, DTO)).rejects.toMatchObject({ status: 503 });

      const untouched = await prisma.user.findUniqueOrThrow({ where: { id: lender.id } });
      expect(untouched).toMatchObject({ deletedAt: null, firstName: 'Nora', email: lender.email });
      await expect(
        prisma.borrower.findUniqueOrThrow({ where: { id: contact.id } }),
      ).resolves.toMatchObject({
        userId: expect.any(String),
      });
      expect({
        loans: await prisma.loan.count(),
        items: await prisma.item.count(),
        contacts: await prisma.borrower.count(),
        invitations: await prisma.contactInvitation.count(),
      }).toEqual(before);
      expect(purged).toEqual([]);
    });

    it('refuses a stale access token: profile update 404, loan creation 401', async () => {
      const { lender, contact } = await lenderWithAcceptedContact('Paul');
      await createLoan({
        lender,
        borrowerUser: await createUser('Quinn'),
        status: LoanStatus.RETURNED,
      });

      await users.deleteAccount(lender.id, DTO);

      await expect(
        users.updateProfile(lender.id, { firstName: 'Paul', email: 'paul-again@example.com' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(loansService().create(lender.id, newLoanDto(contact.id))).rejects.toMatchObject({
        status: 401,
      });
      const tombstone = await prisma.user.findUniqueOrThrow({ where: { id: lender.id } });
      expect(tombstone.firstName).toBe('Compte');
    });

    it('never lets a loan created during the deletion slip through (C2 race)', async () => {
      for (let round = 0; round < 5; round += 1) {
        const { lender, contact } = await lenderWithAcceptedContact(`Race${round}`);

        const [deletion, creation] = await Promise.allSettled([
          users.deleteAccount(lender.id, DTO),
          loansService().create(lender.id, newLoanDto(contact.id)),
        ]);

        const statusOf = (r: PromiseSettledResult<unknown>) =>
          r.status === 'fulfilled' ? 'ok' : (r.reason as { status?: number }).status;
        const outcome = `${statusOf(deletion)}/${statusOf(creation)}`;
        // Either the deletion wins (the creation is refused) or the loan wins (the deletion is refused).
        expect(['ok/401', '409/ok']).toContain(outcome);
        const live = await prisma.user.findUnique({ where: { id: lender.id } });
        const liveLoans = await prisma.loan.count({ where: { lenderId: lender.id } });
        if (outcome === 'ok/401') expect(liveLoans).toBe(0);
        if (outcome === '409/ok') expect(live?.deletedAt).toBeNull();
      }
    });

    it('answers a double tap with one deletion and one 404, never a 500', async () => {
      const lender = await createUser('Rita');
      await createLoan({
        lender,
        borrowerUser: await createUser('Sam'),
        status: LoanStatus.RETURNED,
      });

      const results = await Promise.allSettled([
        users.deleteAccount(lender.id, DTO),
        users.deleteAccount(lender.id, DTO),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((failed.reason as { status?: number }).status).toBe(404);
    });

    it('refuses login and refresh of a deleted account on the real database', async () => {
      const auth = authService();
      const lender = await createUser('Tess');
      await createLoan({
        lender,
        borrowerUser: await createUser('Ugo'),
        status: LoanStatus.RETURNED,
      });
      const session = await auth.login({ email: lender.email, password: PASSWORD });

      await users.deleteAccount(lender.id, DTO);

      await expect(auth.login({ email: lender.email, password: PASSWORD })).rejects.toMatchObject({
        status: 401,
      });
      await expect(auth.refreshTokens(session.refreshToken)).rejects.toMatchObject({ status: 401 });
    });

    it('detaches a borrower for good: re-registration links nothing, a new invitation makes a new contact (C4)', async () => {
      const lender = await createUser('Vera');
      const borrower = await createUser('Will');
      const oldLoan = await createLoan({
        lender,
        borrowerUser: borrower,
        status: LoanStatus.RETURNED,
      });
      const oldContactId = oldLoan.borrowerId;

      await users.deleteAccount(borrower.id, DTO);

      const detached = await prisma.borrower.findUniqueOrThrow({ where: { id: oldContactId } });
      expect(detached).toMatchObject({
        userId: null,
        phoneNumber: null,
        firstName: 'Alias',
        accountDeletedAt: expect.any(Date),
        email: expect.stringMatching(/@deleted\.invalid$/),
      });

      // The same person (or anyone holding the address) signs up again: nothing is relinked.
      const reborn = await authService().register({
        email: borrower.email,
        password: PASSWORD,
        firstName: 'Will',
        lastName: 'Again',
      });
      await new BorrowerLinkingListener(prisma).handleUserRegistered({
        userId: reborn.user.id,
        email: borrower.email,
      });
      await expect(
        prisma.borrower.findUniqueOrThrow({ where: { id: oldContactId } }),
      ).resolves.toMatchObject({ userId: null });

      // The lender invites the new account: accepting it creates a fresh contact, without history.
      const invitations = new ContactInvitationsService(prisma, new EventEmitter2());
      const invitation = await invitations.sendInvitation(lender.id, {
        recipientEmail: borrower.email,
      });
      await invitations.acceptInvitation(invitation.id, reborn.user.id);

      const contacts = await prisma.borrower.findMany({ where: { lenderUserId: lender.id } });
      expect(contacts).toHaveLength(2);
      const fresh = contacts.find((c) => c.id !== oldContactId);
      expect(fresh?.userId).toBe(reborn.user.id);
      await expect(
        prisma.loan.count({ where: { borrower: { userId: reborn.user.id } } }),
      ).resolves.toBe(0);
    });
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
          {
            userId: borrower.id,
            type: 'CONTACT_INVITATION_RECEIVED',
            title: 't',
            body: 'Alice invited you',
            actorUserId: lender.id,
          },
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
          email: expect.stringMatching(
            new RegExp(`^deleted\\+${lender.id}\\.[0-9a-f]{16}@deleted\\.invalid$`),
          ),
          phone: null,
          profilePicture: null,
          lastLoginAt: null,
          language: 'fr',
          deletedAt: expect.any(Date),
        }),
      );
      await expect(bcrypt.compare(PASSWORD, tombstone.password)).resolves.toBe(false);
    });

    it('cannot be blocked by someone holding the predictable tombstone address (review B1)', async () => {
      // An attacker who managed to own the old, guessable address before the deletion.
      await prisma.user.create({
        data: {
          email: `deleted+${lender.id}@deleted.invalid`,
          password: passwordHash,
          firstName: 'Mallory',
          lastName: 'Attacker',
        },
      });

      await expect(users.deleteAccount(lender.id, DTO)).resolves.toBeUndefined();
      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: lender.id } }),
      ).resolves.toMatchObject({
        deletedAt: expect.any(Date),
      });
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
      expect(borrowed.borrower.email).toMatch(/@deleted\.invalid$/);
      expect(borrowed.borrower.phoneNumber).toBeNull();
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

    it('frees the address for a new, unrelated account: nothing of his is relinked (C4)', async () => {
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
      expect(borrowed.borrower.userId).toBeNull();
      expect(borrowed.borrower.accountDeletedAt).toEqual(expect.any(Date));
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

    const other = await createUser('Kim');
    await prisma.notification.create({
      data: {
        userId: other.id,
        type: 'CONTACT_INVITATION_ACCEPTED',
        title: 't',
        body: 'Dan accepted',
        actorUserId: lender.id,
      },
    });

    await users.deleteAccount(lender.id, DTO);

    await expect(prisma.notification.count({ where: { actorUserId: lender.id } })).resolves.toBe(0);
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
