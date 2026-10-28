import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  HttpStatus,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { ValidationError } from 'class-validator';
import { ContactInvitationsController } from '../src/contact-invitations/contact-invitations.controller.js';
import { ContactInvitationsService } from '../src/contact-invitations/contact-invitations.service.js';
import { LoansController } from '../src/loans/loans.controller.js';
import { LoansService } from '../src/loans/loans.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { AllExceptionsFilter } from '../src/common/exceptions/all-exceptions.filter.js';
import {
  ProblemDetailsException,
  ConflictException,
  ForbiddenException,
  BadRequestException as PDBadRequestException,
} from '../src/common/exceptions/problem-details.exception.js';
import type {
  ContactInvitationResponse,
  PaginatedContactInvitationsResponse,
  PaginatedUserSearchResultsResponse,
} from '../src/contact-invitations/interfaces/contact-invitation-response.interface.js';
import type { LoanResponse } from '../src/loans/interfaces/loan-response.interface.js';
import type { AuthenticatedUser } from '../src/auth/strategies/jwt.strategy.js';

// =============================================================================
// Fixtures
// =============================================================================

const SENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECIPIENT_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const INVITATION_ID = '880e8400-e29b-41d4-a716-446655440000';

const MOCK_AUTH_USER: AuthenticatedUser = {
  userId: SENDER_USER_ID,
  email: 'jean.martin@example.com',
  role: 'LENDER',
  jti: 'jti-123',
  tokenExp: Math.floor(Date.now() / 1000) + 900,
};

const MOCK_INVITATION_RESPONSE: ContactInvitationResponse = {
  id: INVITATION_ID,
  status: 'PENDING',
  senderUser: { id: SENDER_USER_ID, firstName: 'Jean', lastName: 'Martin' },
  recipientEmail: 'marie.dupont@example.com',
  recipientUser: { id: RECIPIENT_USER_ID, firstName: 'Marie', lastName: 'Dupont' },
  createdAt: '2025-01-01T00:00:00.000Z',
  expiresAt: '2025-01-31T00:00:00.000Z',
  acceptedAt: null,
  rejectedAt: null,
};

const MOCK_ACCEPTED_RESPONSE: ContactInvitationResponse = {
  ...MOCK_INVITATION_RESPONSE,
  status: 'ACCEPTED',
  acceptedAt: '2025-01-15T10:00:00.000Z',
};

const MOCK_PAGINATED_INVITATIONS: PaginatedContactInvitationsResponse = {
  data: [MOCK_INVITATION_RESPONSE],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const MOCK_SEARCH_RESULTS: PaginatedUserSearchResultsResponse = {
  data: [
    {
      id: RECIPIENT_USER_ID,
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie.dupont@example.com',
      alreadyContact: false,
      pendingInvitation: false,
      pendingInvitationId: null,
    },
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

// =============================================================================
// Constraint-to-code map (mirrors main.ts)
// =============================================================================

const CONSTRAINT_CODE_MAP: Record<string, string> = {
  isEmail: 'INVALID_EMAIL',
  isNotEmpty: 'REQUIRED',
  isString: 'INVALID_TYPE',
  isUuid: 'INVALID_UUID',
  minLength: 'TOO_SHORT',
  whitelistValidation: 'UNKNOWN_FIELD',
};

function constraintToCode(constraintName: string): string {
  return CONSTRAINT_CODE_MAP[constraintName] ?? 'VALIDATION_ERROR';
}

// =============================================================================
// Mock Guard
// =============================================================================

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = MOCK_AUTH_USER;
    return true;
  }
}

// =============================================================================
// E2E Test Suite — ContactInvitations (CINV-013)
// =============================================================================

describe('ContactInvitations (e2e)', () => {
  let app: INestApplication<App>;
  let service: Record<string, jest.Mock>;

  beforeAll(async () => {
    service = {
      searchUsers: jest.fn(),
      sendInvitation: jest.fn(),
      listInvitations: jest.fn(),
      acceptInvitation: jest.fn(),
      rejectInvitation: jest.fn(),
      cancelInvitation: jest.fn(),
      hasAcceptedContact: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ContactInvitationsController],
      providers: [{ provide: ContactInvitationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply the same ValidationPipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[]) => {
          const details = errors.flatMap((err) => {
            const constraints = err.constraints ?? {};
            return Object.entries(constraints).map(([key, message]) => ({
              field: err.property,
              code: constraintToCode(key),
              message,
            }));
          });
          return new BadRequestException({ message: details, error: 'Validation Failed' });
        },
      }),
    );

    // RFC 7807 exception filter
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // POST /contact-invitations/search — Search Users
  // ===========================================================================

  describe('POST /contact-invitations/search', () => {
    it('should return 200 with search results', async () => {
      service.searchUsers.mockResolvedValue(MOCK_SEARCH_RESULTS);

      const res = await request(app.getHttpServer())
        .post('/contact-invitations/search')
        .send({ query: 'marie' })
        .expect(HttpStatus.OK);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe('marie.dupont@example.com');
      expect(res.body.pagination).toBeDefined();
      expect(service.searchUsers).toHaveBeenCalledWith(SENDER_USER_ID, {
        query: 'marie',
        page: 1,
        limit: 20,
      });
    });

    it('should return 400 when query is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact-invitations/search')
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.type).toBe('https://api.return.app/errors/validation-failed');
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some((e: { field: string }) => e.field === 'query')).toBe(true);
    });

    it('should return 400 when query is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact-invitations/search')
        .send({ query: 'a' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.type).toBe('https://api.return.app/errors/validation-failed');
      expect(res.body.errors.some((e: { field: string }) => e.field === 'query')).toBe(true);
    });
  });

  // ===========================================================================
  // POST /contact-invitations — Send Invitation
  // ===========================================================================

  describe('POST /contact-invitations', () => {
    it('should return 201 with Location header', async () => {
      service.sendInvitation.mockResolvedValue(MOCK_INVITATION_RESPONSE);

      const res = await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({ recipientEmail: 'marie.dupont@example.com' })
        .expect(HttpStatus.CREATED);

      expect(res.body.id).toBe(INVITATION_ID);
      expect(res.body.status).toBe('PENDING');
      expect(res.headers.location).toContain(`/v1/contact-invitations/${INVITATION_ID}`);
      expect(service.sendInvitation).toHaveBeenCalledWith(SENDER_USER_ID, {
        recipientEmail: 'marie.dupont@example.com',
      });
    });

    it('should return 400 when recipientEmail is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.type).toBe('https://api.return.app/errors/validation-failed');
      expect(res.body.errors.some((e: { field: string }) => e.field === 'recipientEmail')).toBe(
        true,
      );
    });

    it('should return 400 when recipientEmail is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({ recipientEmail: 'not-an-email' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.type).toBe('https://api.return.app/errors/validation-failed');
    });

    it('should return 400 when self-invitation', async () => {
      service.sendInvitation.mockRejectedValue(
        new PDBadRequestException(
          'self-invitation',
          'Self Invitation',
          'You cannot send an invitation to yourself.',
          '/v1/contact-invitations',
        ),
      );

      await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({ recipientEmail: 'jean.martin@example.com' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 when recipient user not found', async () => {
      service.sendInvitation.mockRejectedValue(
        new ProblemDetailsException(
          HttpStatus.NOT_FOUND,
          'user-not-found',
          'User Not Found',
          'No registered user found for this email.',
          '/v1/contact-invitations',
        ),
      );

      await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({ recipientEmail: 'unknown@example.com' })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 409 when invitation already sent', async () => {
      service.sendInvitation.mockRejectedValue(
        new ConflictException(
          'invitation-already-sent',
          'Invitation Already Sent',
          'A pending invitation already exists for this user.',
          '/v1/contact-invitations',
        ),
      );

      await request(app.getHttpServer())
        .post('/contact-invitations')
        .send({ recipientEmail: 'marie.dupont@example.com' })
        .expect(HttpStatus.CONFLICT);
    });
  });

  // ===========================================================================
  // GET /contact-invitations — List Invitations
  // ===========================================================================

  describe('GET /contact-invitations', () => {
    it('should return 200 with paginated invitations (default: received)', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      const res = await request(app.getHttpServer())
        .get('/contact-invitations')
        .expect(HttpStatus.OK);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.currentPage).toBe(1);
      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'received',
        status: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should accept direction=sent query parameter', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      await request(app.getHttpServer())
        .get('/contact-invitations?direction=sent')
        .expect(HttpStatus.OK);

      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'sent',
        status: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should accept status filter', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      await request(app.getHttpServer())
        .get('/contact-invitations?status=PENDING')
        .expect(HttpStatus.OK);

      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'received',
        status: 'PENDING',
        page: 1,
        limit: 20,
      });
    });

    it('should accept pagination parameters', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      await request(app.getHttpServer())
        .get('/contact-invitations?page=2&limit=5')
        .expect(HttpStatus.OK);

      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'received',
        status: undefined,
        page: 2,
        limit: 5,
      });
    });
  });

  // ===========================================================================
  // POST /contact-invitations/:id/accept — Accept Invitation
  // ===========================================================================

  describe('POST /contact-invitations/:id/accept', () => {
    it('should return 200 with accepted invitation', async () => {
      service.acceptInvitation.mockResolvedValue(MOCK_ACCEPTED_RESPONSE);

      const res = await request(app.getHttpServer())
        .post(`/contact-invitations/${INVITATION_ID}/accept`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.acceptedAt).toBeDefined();
      expect(service.acceptInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact-invitations/not-a-uuid/accept')
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.type).toBe('https://api.return.app/errors/validation-failed');
    });

    it('should return 403 when user is not the recipient', async () => {
      service.acceptInvitation.mockRejectedValue(
        new ForbiddenException(
          'not-recipient',
          'Forbidden',
          'Only the recipient can accept this invitation.',
          `/v1/contact-invitations/${INVITATION_ID}/accept`,
        ),
      );

      await request(app.getHttpServer())
        .post(`/contact-invitations/${INVITATION_ID}/accept`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 when invitation not found', async () => {
      const unknownId = '990e8400-e29b-41d4-a716-446655440000';
      service.acceptInvitation.mockRejectedValue(
        new ProblemDetailsException(
          HttpStatus.NOT_FOUND,
          'invitation-not-found',
          'Invitation Not Found',
          `Invitation ${unknownId} not found.`,
          `/contact-invitations/${unknownId}/accept`,
        ),
      );

      await request(app.getHttpServer())
        .post(`/contact-invitations/${unknownId}/accept`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 409 when invitation is not PENDING', async () => {
      service.acceptInvitation.mockRejectedValue(
        new ConflictException(
          'invitation-not-pending',
          'Invitation Not Pending',
          'This invitation has already been processed.',
          `/v1/contact-invitations/${INVITATION_ID}/accept`,
        ),
      );

      await request(app.getHttpServer())
        .post(`/contact-invitations/${INVITATION_ID}/accept`)
        .expect(HttpStatus.CONFLICT);
    });
  });

  // ===========================================================================
  // POST /contact-invitations/:id/reject — Reject Invitation
  // ===========================================================================

  describe('POST /contact-invitations/:id/reject', () => {
    it('should return 204 on successful rejection', async () => {
      service.rejectInvitation.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/contact-invitations/${INVITATION_ID}/reject`)
        .expect(HttpStatus.NO_CONTENT);

      expect(service.rejectInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
    });

    it('should return 403 when user is not the recipient', async () => {
      service.rejectInvitation.mockRejectedValue(
        new ForbiddenException(
          'not-recipient',
          'Forbidden',
          'Only the recipient can reject this invitation.',
          `/v1/contact-invitations/${INVITATION_ID}/reject`,
        ),
      );

      await request(app.getHttpServer())
        .post(`/contact-invitations/${INVITATION_ID}/reject`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===========================================================================
  // DELETE /contact-invitations/:id — Cancel Invitation
  // ===========================================================================

  describe('DELETE /contact-invitations/:id', () => {
    it('should return 204 on successful cancellation', async () => {
      service.cancelInvitation.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/contact-invitations/${INVITATION_ID}`)
        .expect(HttpStatus.NO_CONTENT);

      expect(service.cancelInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
    });

    it('should return 403 when user is not the sender', async () => {
      service.cancelInvitation.mockRejectedValue(
        new ForbiddenException(
          'not-sender',
          'Forbidden',
          'Only the sender can cancel this invitation.',
          `/v1/contact-invitations/${INVITATION_ID}`,
        ),
      );

      await request(app.getHttpServer())
        .delete(`/contact-invitations/${INVITATION_ID}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 409 when invitation is already accepted', async () => {
      service.cancelInvitation.mockRejectedValue(
        new ConflictException(
          'invitation-already-accepted',
          'Already Accepted',
          'Cannot cancel an invitation that has already been accepted.',
          `/v1/contact-invitations/${INVITATION_ID}`,
        ),
      );

      await request(app.getHttpServer())
        .delete(`/contact-invitations/${INVITATION_ID}`)
        .expect(HttpStatus.CONFLICT);
    });
  });
});

// =============================================================================
// CINV-016: Inter-module E2E — Loan creation requires ACCEPTED contact
// =============================================================================

describe('ContactInvitations ↔ Loans inter-module (e2e)', () => {
  let app: INestApplication<App>;
  let loansService: Record<string, jest.Mock>;

  beforeAll(async () => {
    loansService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateStatus: jest.fn(),
      confirm: jest.fn(),
      contest: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [{ provide: LoansService, useValue: loansService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[]) => {
          const details = errors.flatMap((err) => {
            const constraints = err.constraints ?? {};
            return Object.entries(constraints).map(([key, message]) => ({
              field: err.property,
              code: constraintToCode(key),
              message,
            }));
          });
          return new BadRequestException({ message: details, error: 'Validation Failed' });
        },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** returnDate is mandatory and must be at least J+2: use J+10 (date-only, UTC). */
  const futureReturnDate = (): string =>
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it('should return 403 when loan created without ACCEPTED contact', async () => {
    loansService.create.mockRejectedValue(
      new ForbiddenException(
        'contact-not-accepted',
        'Contact Not Accepted',
        'You can only create a loan for a contact with an ACCEPTED invitation.',
        '/v1/loans',
      ),
    );

    const res = await request(app.getHttpServer())
      .post('/loans')
      .send({
        borrowerId: RECIPIENT_USER_ID,
        item: { name: 'Test Item', category: 'TOOLS' },
        returnDate: futureReturnDate(),
      })
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.type).toBe('https://api.return.app/errors/contact-not-accepted');
    expect(res.body.title).toBe('Contact Not Accepted');
    expect(res.body.status).toBe(403);
  });

  it('should return 201 when loan created with ACCEPTED contact', async () => {
    const mockLoanResponse: Partial<LoanResponse> = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING_CONFIRMATION',
      borrower: {
        id: RECIPIENT_USER_ID,
        firstName: 'Marie',
        lastName: 'Dupont',
        email: 'marie.dupont@example.com',
        phoneNumber: null,
        userId: RECIPIENT_USER_ID,
        statistics: {
          trustScore: 0,
          totalLoans: 0,
          returnedOnTime: 0,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: null,
        },
      },
    };
    loansService.create.mockResolvedValue(mockLoanResponse);

    const res = await request(app.getHttpServer())
      .post('/loans')
      .send({
        borrowerId: RECIPIENT_USER_ID,
        item: { name: 'Test Item', category: 'TOOLS' },
        returnDate: futureReturnDate(),
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.status).toBe('PENDING_CONFIRMATION');
    expect(res.headers.location).toContain('/v1/loans/');
  });
});
