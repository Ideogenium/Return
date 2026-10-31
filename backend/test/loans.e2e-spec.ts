import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ExecutionContext,
  CanActivate,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoanStatus } from '@prisma/client';
import type { ValidationError } from 'class-validator';
import { LoansController } from '../src/loans/loans.controller';
import { LoansService } from '../src/loans/loans.service';
import { LoansCronService } from '../src/loans/loans-cron.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ContactInvitationsService } from '../src/contact-invitations/contact-invitations.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../src/auth/strategies/jwt.strategy';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';
const ITEM_ID = '220e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';

const NOW = new Date('2025-02-27T12:00:00.000Z');
const RETURN_DATE = new Date('2025-06-01');

const MOCK_BORROWER = {
  id: BORROWER_ID,
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  phoneNumber: '+33612345678',
  userId: BORROWER_USER_ID,
  lenderUserId: LENDER_USER_ID,
  totalLoans: 0,
  returnedOnTime: 0,
  returnedLate: 0,
  notReturned: 0,
  averageReturnDelay: null,
  trustScore: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_ITEM = {
  id: ITEM_ID,
  name: 'Perceuse',
  description: 'Perceuse Bosch',
  category: 'TOOLS',
  estimatedValue: 150,
  ownerUserId: LENDER_USER_ID,
  photos: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_LENDER = {
  id: LENDER_USER_ID,
  email: 'lender@example.com',
  firstName: 'John',
  lastName: 'Doe',
  passwordHash: 'x',
  profilePicture: null,
  preferredLanguage: 'fr',
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_LOAN = {
  id: LOAN_ID,
  itemId: ITEM_ID,
  borrowerId: BORROWER_ID,
  lenderId: LENDER_USER_ID,
  returnDate: RETURN_DATE,
  status: LoanStatus.PENDING_CONFIRMATION,
  confirmationDate: null,
  returnedDate: null,
  notes: 'Test loan',
  contestReason: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  item: MOCK_ITEM,
  lender: MOCK_LENDER,
  borrower: MOCK_BORROWER,
};

// =============================================================================
// Dynamic Auth Guard — allows switching user between requests
// =============================================================================

let currentAuthUser: AuthenticatedUser;

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = currentAuthUser;
    return true;
  }
}

function setAuthUser(userId: string, email: string): void {
  currentAuthUser = {
    userId,
    email,
    role: 'LENDER',
    jti: 'jti-test',
    tokenExp: Math.floor(Date.now() / 1000) + 900,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Loans Integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: DeepMockProxy<PrismaService>;

  beforeAll(async () => {
    prisma = mockDeep<PrismaService>();
    const redis = mockDeep<RedisService>();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [LoansController],
      providers: [
        LoansService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        {
          provide: ContactInvitationsService,
          useValue: { hasAcceptedContact: jest.fn().mockResolvedValue(true) },
        },
        { provide: LoansCronService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Reproduce main.ts global config
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[]) => {
          const details = errors.flatMap((err) => {
            const constraints = err.constraints ?? {};
            return Object.entries(constraints).map(([, message]) => ({
              field: err.property,
              message,
            }));
          });
          return new BadRequestException({ message: details, error: 'Validation Failed' });
        },
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

  // ===========================================================================
  // INTEG-010 — GET /v1/loans?role=borrower retourne les prêts après liaison
  // ===========================================================================

  describe('INTEG-010: GET /loans?role=borrower returns loans for linked borrower', () => {
    it('should return non-empty loans list when user is a linked borrower', async () => {
      // Arrange — set authenticated user to the borrower
      setAuthUser(BORROWER_USER_ID, 'marie@example.com');

      // Prisma mock: findMany returns a loan where borrower.userId matches
      prisma.loan.findMany.mockResolvedValue([MOCK_LOAN] as never);
      prisma.loan.count.mockResolvedValue(1);

      // Act
      const response = await request(app.getHttpServer())
        .get('/v1/loans')
        .query({ role: 'borrower' })
        .expect(200);

      // Assert — non-empty data
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(LOAN_ID);
      expect(response.body.pagination.totalItems).toBe(1);

      // Verify Prisma was called with borrower perspective filter
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borrower: { userId: BORROWER_USER_ID },
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // INTEG-011 — GET /v1/loans/:id accessible par l'emprunteur
  // ===========================================================================

  describe('INTEG-011: GET /loans/:id accessible by borrower via resolveUserRole', () => {
    it('should return 200 OK when the borrower accesses a loan they are linked to', async () => {
      // Arrange — borrower authenticated
      setAuthUser(BORROWER_USER_ID, 'marie@example.com');

      // Prisma mock: findUnique returns a loan with borrower.userId = BORROWER_USER_ID
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN as never);

      // Act
      const response = await request(app.getHttpServer()).get(`/v1/loans/${LOAN_ID}`).expect(200);

      // Assert — loan data returned
      expect(response.body.id).toBe(LOAN_ID);
      expect(response.body.borrower.userId).toBe(BORROWER_USER_ID);
    });
  });

  // ===========================================================================
  // FIX-28 — a third party gets the same 404 as for a missing loan
  // ===========================================================================

  describe('FIX-28: third party gets a 404 indistinguishable from a missing loan', () => {
    const visible = (body: Record<string, unknown>): Record<string, unknown> => ({
      status: body.status,
      type: body.type,
      title: body.title,
      detail: body.detail,
    });

    it.each([
      ['GET', (id: string) => request(app.getHttpServer()).get(`/v1/loans/${id}`)],
      ['DELETE', (id: string) => request(app.getHttpServer()).delete(`/v1/loans/${id}`)],
    ])('should answer %s on a foreign loan like on a missing one', async (_method, call) => {
      setAuthUser(OTHER_USER_ID, 'other@example.com');

      prisma.loan.findUnique.mockResolvedValueOnce(null);
      const missing = await call(LOAN_ID).expect(404);

      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN as never);
      const foreign = await call(LOAN_ID).expect(404);

      expect(visible(foreign.body)).toEqual(visible(missing.body));
    });

    it('should keep 403 for the borrower, a party to the loan, on DELETE', async () => {
      setAuthUser(BORROWER_USER_ID, 'marie@example.com');
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN as never);

      await request(app.getHttpServer()).delete(`/v1/loans/${LOAN_ID}`).expect(403);
    });
  });

  // ===========================================================================
  // INTEG-012 — GET /v1/loans?role=borrower par tiers retourne vide
  // ===========================================================================

  describe('INTEG-012: GET /loans?role=borrower by third-party returns empty', () => {
    it('should return 200 with data: [] for a user who is neither lender nor borrower', async () => {
      // Arrange — third party user, not linked to any borrower
      setAuthUser(OTHER_USER_ID, 'other@example.com');

      // Prisma mock: no loans match the third party's userId in borrower.userId
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      // Act
      const response = await request(app.getHttpServer())
        .get('/v1/loans')
        .query({ role: 'borrower' })
        .expect(200);

      // Assert — empty data
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalItems).toBe(0);

      // Verify Prisma was called with the third party's userId
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borrower: { userId: OTHER_USER_ID },
          }),
        }),
      );
    });
  });
});
