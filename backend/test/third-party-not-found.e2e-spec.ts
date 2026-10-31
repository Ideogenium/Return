import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import type { Test as SupertestTest } from 'supertest';
import type { App } from 'supertest/types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoanStatus, ReminderStatus } from '@prisma/client';
import type { ValidationError } from 'class-validator';
import { LoansController } from '../src/loans/loans.controller';
import { LoansService } from '../src/loans/loans.service';
import { ItemsController } from '../src/items/items.controller';
import { ItemsService } from '../src/items/items.service';
import { BorrowersController } from '../src/borrowers/borrowers.controller';
import { BorrowersService } from '../src/borrowers/borrowers.service';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';
import { DeviceTokensService } from '../src/notifications/device-tokens.service';
import { RemindersController } from '../src/reminders/reminders.controller';
import { RemindersService } from '../src/reminders/reminders.service';
import { ContactInvitationsController } from '../src/contact-invitations/contact-invitations.controller';
import { ContactInvitationsService } from '../src/contact-invitations/contact-invitations.service';
import { TrustScoreService } from '../src/trust-score/trust-score.service';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PHOTO_STORAGE } from '../src/storage/interfaces/photo-storage.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/exceptions/all-exceptions.filter';
import type { AuthenticatedUser } from '../src/auth/strategies/jwt.strategy';

// =============================================================================
// FIX-28 — a third party must not be able to tell "not mine" from "does not exist"
// =============================================================================
// Real controllers, services, pipes and AllExceptionsFilter; only Prisma (and the
// infrastructure around it) is mocked. One dedicated file rather than one assertion per
// module e2e: some of those suites mock their service entirely, and the rule is
// cross-cutting, so a single table of routes keeps it from being forgotten by the next one.
// For each route the same id is requested twice, once absent and once owned by someone else.
// =============================================================================

// FileTypeValidator loads the ESM package `file-type` through a dynamic import, which Jest's
// CommonJS runtime cannot do; a minimal JPEG signature detector stands in for it.
jest.mock('load-esm', () => ({
  loadEsm: () =>
    Promise.resolve({
      fileTypeFromBuffer: (buffer: Buffer) =>
        Promise.resolve(
          buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
            ? { ext: 'jpg', mime: 'image/jpeg' }
            : undefined,
        ),
    }),
}));

const OWNER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const THIRD_PARTY_ID = '660e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';
const ITEM_ID = '220e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const PHOTO_ID = '440e8400-e29b-41d4-a716-446655440000';
const NOTIFICATION_ID = '880e8400-e29b-41d4-a716-446655440000';
const REMINDER_ID = '990e8400-e29b-41d4-a716-446655440000';
const INVITATION_ID = 'aa0e8400-e29b-41d4-a716-446655440000';

const NOW = new Date('2026-10-01T12:00:00.000Z');

const USER = {
  id: OWNER_ID,
  email: 'owner@example.com',
  firstName: 'Own',
  lastName: 'Er',
  profilePicture: null,
};
const RECIPIENT = { ...USER, id: BORROWER_USER_ID, email: 'borrower@example.com' };

const BORROWER_ROW = {
  id: BORROWER_ID,
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  phoneNumber: null,
  userId: BORROWER_USER_ID,
  lenderUserId: OWNER_ID,
  totalLoans: 0,
  returnedOnTime: 0,
  returnedLate: 0,
  notReturned: 0,
  averageReturnDelay: null,
  trustScore: 0,
};

const ITEM_ROW = {
  id: ITEM_ID,
  name: 'Drill',
  description: null,
  category: 'TOOLS',
  estimatedValue: null,
  userId: OWNER_ID,
  deletedAt: null,
  createdAt: NOW,
  photos: [{ id: PHOTO_ID, url: 'u', thumbnailUrl: 't', uploadedAt: NOW, itemId: ITEM_ID }],
};

const LOAN_ROW = {
  id: LOAN_ID,
  itemId: ITEM_ID,
  borrowerId: BORROWER_ID,
  lenderId: OWNER_ID,
  returnDate: null,
  status: LoanStatus.PENDING_CONFIRMATION,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  item: ITEM_ROW,
  lender: USER,
  borrower: BORROWER_ROW,
};

const REMINDER_ROW = {
  id: REMINDER_ID,
  loanId: LOAN_ID,
  status: ReminderStatus.SCHEDULED,
  loan: { id: LOAN_ID, lenderId: OWNER_ID, borrower: { userId: BORROWER_USER_ID } },
};

const NOTIFICATION_ROW = { id: NOTIFICATION_ID, userId: OWNER_ID, isRead: false };

const INVITATION_ROW = {
  id: INVITATION_ID,
  status: 'PENDING',
  senderUserId: OWNER_ID,
  recipientUserId: BORROWER_USER_ID,
  recipientEmail: RECIPIENT.email,
  senderUser: USER,
  recipientUser: RECIPIENT,
};

// =============================================================================
// Test harness
// =============================================================================

let currentAuthUser: AuthenticatedUser;

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = currentAuthUser;
    return true;
  }
}

function setAuthUser(userId: string): void {
  currentAuthUser = {
    userId,
    email: `${userId}@example.com`,
    role: 'LENDER',
    jti: 'jti-test',
    tokenExp: Math.floor(Date.now() / 1000) + 900,
  };
}

type Call = (agent: ReturnType<typeof request>) => SupertestTest;

// A minimal JPEG signature: the upload pipe checks the magic numbers, not the extension.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

/** Every route of the FIX-28 scope, with a body valid enough to reach the ownership check. */
const ROUTES: [string, Call][] = [
  // Loans
  ['GET /loans/:id', (a) => a.get(`/v1/loans/${LOAN_ID}`)],
  ['PATCH /loans/:id', (a) => a.patch(`/v1/loans/${LOAN_ID}`).send({ notes: 'x' })],
  ['DELETE /loans/:id', (a) => a.delete(`/v1/loans/${LOAN_ID}`)],
  [
    'PATCH /loans/:id/status',
    (a) => a.patch(`/v1/loans/${LOAN_ID}/status`).send({ status: LoanStatus.ACTIVE }),
  ],
  ['POST /loans/:id/confirm', (a) => a.post(`/v1/loans/${LOAN_ID}/confirm`)],
  [
    'POST /loans/:id/contest',
    (a) => a.post(`/v1/loans/${LOAN_ID}/contest`).send({ reason: 'This is not my loan.' }),
  ],
  // Items
  ['GET /items/:id', (a) => a.get(`/v1/items/${ITEM_ID}`)],
  ['PATCH /items/:id', (a) => a.patch(`/v1/items/${ITEM_ID}`).send({ name: 'New name' })],
  ['DELETE /items/:id', (a) => a.delete(`/v1/items/${ITEM_ID}`)],
  [
    'POST /items/:id/photos',
    (a) =>
      a
        .post(`/v1/items/${ITEM_ID}/photos`)
        .attach('photo', JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' }),
  ],
  ['DELETE /items/:id/photos/:photoId', (a) => a.delete(`/v1/items/${ITEM_ID}/photos/${PHOTO_ID}`)],
  // Contacts (borrowers)
  ['GET /borrowers/:id', (a) => a.get(`/v1/borrowers/${BORROWER_ID}`)],
  ['PATCH /borrowers/:id', (a) => a.patch(`/v1/borrowers/${BORROWER_ID}`).send({ firstName: 'A' })],
  ['DELETE /borrowers/:id', (a) => a.delete(`/v1/borrowers/${BORROWER_ID}`)],
  ['GET /borrowers/:id/statistics', (a) => a.get(`/v1/borrowers/${BORROWER_ID}/statistics`)],
  ['GET /borrowers/:id/loans', (a) => a.get(`/v1/borrowers/${BORROWER_ID}/loans`)],
  // Notifications
  ['PATCH /notifications/:id/read', (a) => a.patch(`/v1/notifications/${NOTIFICATION_ID}/read`)],
  // Reminders
  ['GET /loans/:id/reminders', (a) => a.get(`/v1/loans/${LOAN_ID}/reminders`)],
  ['GET /reminders/:id', (a) => a.get(`/v1/reminders/${REMINDER_ID}`)],
  ['POST /reminders/:id/cancel', (a) => a.post(`/v1/reminders/${REMINDER_ID}/cancel`)],
  // Contact invitations
  [
    'POST /contact-invitations/:id/accept',
    (a) => a.post(`/v1/contact-invitations/${INVITATION_ID}/accept`),
  ],
  [
    'POST /contact-invitations/:id/reject',
    (a) => a.post(`/v1/contact-invitations/${INVITATION_ID}/reject`),
  ],
  ['DELETE /contact-invitations/:id', (a) => a.delete(`/v1/contact-invitations/${INVITATION_ID}`)],
];

/** What a client can observe of an error, minus the per-response timestamp and request id. */
function observable(res: request.Response): Record<string, unknown> {
  const { status, type, title, detail, instance } = res.body as Record<string, unknown>;
  return {
    httpStatus: res.status,
    contentType: res.headers['content-type'],
    status,
    type,
    title,
    detail,
    instance,
  };
}

describe('FIX-28: third party vs missing resource (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: DeepMockProxy<PrismaService>;

  /** Makes every looked-up resource exist (owned by OWNER_ID) or be absent. */
  function arrange(exists: boolean): void {
    const row = <T>(value: T): never => (exists ? value : null) as never;
    prisma.loan.findUnique.mockResolvedValue(row(LOAN_ROW));
    prisma.item.findUnique.mockResolvedValue(row(ITEM_ROW));
    prisma.borrower.findUnique.mockResolvedValue(row(BORROWER_ROW));
    prisma.notification.findUnique.mockResolvedValue(row(NOTIFICATION_ROW));
    prisma.reminder.findUnique.mockResolvedValue(row(REMINDER_ROW));
    prisma.contactInvitation.findUnique.mockResolvedValue(row(INVITATION_ROW));
  }

  beforeAll(async () => {
    prisma = mockDeep<PrismaService>();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [
        LoansController,
        ItemsController,
        BorrowersController,
        NotificationsController,
        RemindersController,
        ContactInvitationsController,
      ],
      providers: [
        LoansService,
        ItemsService,
        BorrowersService,
        NotificationsService,
        RemindersService,
        ContactInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockDeep<RedisService>() },
        { provide: PHOTO_STORAGE, useValue: mockDeep<{ upload: unknown; delete: unknown }>() },
        { provide: TrustScoreService, useValue: mockDeep<TrustScoreService>() },
        { provide: FirebaseService, useValue: mockDeep<FirebaseService>() },
        { provide: DeviceTokensService, useValue: mockDeep<DeviceTokensService>() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Reproduce main.ts global config
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException({
            message: errors.flatMap((err) =>
              Object.values(err.constraints ?? {}).map((message) => ({
                field: err.property,
                message,
              })),
            ),
            error: 'Validation Failed',
          }),
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(ROUTES)(
    '%s: a third party gets the same 404 as for a missing id',
    async (_route, call) => {
      setAuthUser(THIRD_PARTY_ID);

      arrange(false);
      const missing = await call(request(app.getHttpServer()));
      arrange(true);
      const foreign = await call(request(app.getHttpServer()));

      expect(missing.status).toBe(404);
      expect(missing.headers['content-type']).toContain('application/problem+json');
      expect(observable(foreign)).toEqual(observable(missing));
      // Nothing may have been written on behalf of the third party.
      expect(prisma.loan.update).not.toHaveBeenCalled();
      expect(prisma.item.update).not.toHaveBeenCalled();
      expect(prisma.borrower.update).not.toHaveBeenCalled();
      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(prisma.reminder.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  // A party to the resource is not a stranger: the contract keeps 403 for them.
  describe('a party without the right keeps the 403', () => {
    const FORBIDDEN_FOR_PARTY: [string, string, Call][] = [
      [
        'PATCH /loans/:id',
        BORROWER_USER_ID,
        (a) => a.patch(`/v1/loans/${LOAN_ID}`).send({ notes: 'x' }),
      ],
      ['DELETE /loans/:id', BORROWER_USER_ID, (a) => a.delete(`/v1/loans/${LOAN_ID}`)],
      ['POST /loans/:id/confirm', OWNER_ID, (a) => a.post(`/v1/loans/${LOAN_ID}/confirm`)],
      [
        'POST /loans/:id/contest',
        OWNER_ID,
        (a) => a.post(`/v1/loans/${LOAN_ID}/contest`).send({ reason: 'Not returned yet.' }),
      ],
      [
        'GET /loans/:id/reminders',
        BORROWER_USER_ID,
        (a) => a.get(`/v1/loans/${LOAN_ID}/reminders`),
      ],
      ['GET /reminders/:id', BORROWER_USER_ID, (a) => a.get(`/v1/reminders/${REMINDER_ID}`)],
      [
        'POST /reminders/:id/cancel',
        BORROWER_USER_ID,
        (a) => a.post(`/v1/reminders/${REMINDER_ID}/cancel`),
      ],
    ];

    it.each(FORBIDDEN_FOR_PARTY)('%s as a party answers 403', async (_route, userId, call) => {
      setAuthUser(userId);
      arrange(true);

      const res = await call(request(app.getHttpServer()));

      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });
});
