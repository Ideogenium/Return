import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { LoansService } from './loans.service.js';
import { ContactInvitationsService } from '../contact-invitations/contact-invitations.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';
import { LoanStatus, ItemCategory, UserRole } from '@prisma/client';
import type { Loan, Item, Photo, User, Borrower } from '@prisma/client';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';
const ITEM_ID = '220e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const PHOTO_ID = '440e8400-e29b-41d4-a716-446655440000';

const MOCK_USER: User = {
  id: LENDER_USER_ID,
  email: 'lender@example.com',
  password: 'hashed',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.LENDER,
  profilePicture: null,
  phone: null,
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  lastLoginAt: null,
};

const MOCK_ITEM: Item = {
  id: ITEM_ID,
  name: 'Perceuse',
  description: 'Perceuse Bosch',
  category: ItemCategory.TOOLS,
  estimatedValue: 150,
  userId: LENDER_USER_ID,
  deletedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const MOCK_PHOTO: Photo = {
  id: PHOTO_ID,
  url: 'https://r2.example.com/photo.jpg',
  thumbnailUrl: 'https://r2.example.com/photo-thumb.jpg',
  itemId: ITEM_ID,
  uploadedAt: new Date('2025-01-01T00:00:00Z'),
};

const MOCK_BORROWER: Borrower = {
  id: BORROWER_ID,
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  phoneNumber: '+33612345678',
  userId: BORROWER_USER_ID,
  lenderUserId: LENDER_USER_ID,
  trustScore: 0,
  totalLoans: 0,
  returnedOnTime: 0,
  returnedLate: 0,
  notReturned: 0,
  averageReturnDelay: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const NOW = new Date('2025-02-27T12:00:00Z');

const MOCK_LOAN: Loan & { item: Item & { photos: Photo[] }; lender: User; borrower: Borrower } = {
  id: LOAN_ID,
  itemId: ITEM_ID,
  lenderId: LENDER_USER_ID,
  borrowerId: BORROWER_ID,
  status: LoanStatus.PENDING_CONFIRMATION,
  returnDate: new Date('2025-06-01'),
  confirmationDate: null,
  returnedDate: null,
  notes: 'Test loan',
  contestReason: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  item: { ...MOCK_ITEM, photos: [MOCK_PHOTO] },
  lender: MOCK_USER,
  borrower: MOCK_BORROWER,
};

function createMockRedisClient() {
  return { get: jest.fn(), incr: jest.fn(), expire: jest.fn() };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('LoansService', () => {
  let service: LoansService;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: { emit: jest.Mock };
  let redisClient: ReturnType<typeof createMockRedisClient>;
  let redisService: { getClient: jest.Mock };
  let contactInvitationsService: { hasAcceptedContact: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    // Pass through $transaction so callbacks receive the same mock client
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    );
    eventEmitter = { emit: jest.fn() };
    redisClient = createMockRedisClient();
    redisService = { getClient: jest.fn().mockReturnValue(redisClient) };
    contactInvitationsService = { hasAcceptedContact: jest.fn().mockResolvedValue(true) };

    // Default: no rate limit hit
    redisClient.get.mockResolvedValue(null);
    redisClient.incr.mockResolvedValue(1);
    redisClient.expire.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ContactInvitationsService, useValue: contactInvitationsService },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
  });

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    const CREATE_DTO = {
      item: ITEM_ID,
      borrowerId: BORROWER_ID,
      returnDate: '2099-06-01',
      notes: 'Test loan',
    };

    it('should create a loan with existing item UUID and borrower UUID', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.create.mockResolvedValue(MOCK_LOAN);

      const result = await service.create(LENDER_USER_ID, CREATE_DTO);

      expect(result.id).toBe(LOAN_ID);
      expect(result.status).toBe(LoanStatus.PENDING_CONFIRMATION);
      expect(result.item.id).toBe(ITEM_ID);
      expect(result.borrower.id).toBe(BORROWER_ID);
      expect(result.lender.id).toBe(LENDER_USER_ID);
      expect(result.notes).toBe('Test loan');
      expect(result.returnDate).toBe('2025-06-01');
      expect(prisma.loan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: ITEM_ID,
            lenderId: LENDER_USER_ID,
            borrowerId: BORROWER_ID,
            status: LoanStatus.PENDING_CONFIRMATION,
          }),
        }),
      );
    });

    it('should emit LOAN_EVENTS.CREATED after creation', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.create.mockResolvedValue(MOCK_LOAN);

      await service.create(LENDER_USER_ID, CREATE_DTO);

      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.CREATED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        returnDate: new Date('2025-06-01'),
        createdAt: NOW,
      });
    });

    it('should increment Redis daily counter', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.create.mockResolvedValue(MOCK_LOAN);

      await service.create(LENDER_USER_ID, CREATE_DTO);

      expect(redisClient.incr).toHaveBeenCalled();
    });

    it('should throw 409 when the item already has an active loan (FIX-04)', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      // An active loan already exists for this item
      prisma.loan.findFirst.mockResolvedValue({ id: 'existing-active-loan' } as never);

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected ConflictException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toBe('https://api.return.app/errors/item-already-loaned');
      }

      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('should create inline item when item is an object', async () => {
      const inlineItem = {
        name: 'New Item',
        category: ItemCategory.TOOLS,
        description: 'A new tool',
      };
      prisma.item.create.mockResolvedValue({ ...MOCK_ITEM, name: 'New Item' });
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.create.mockResolvedValue(MOCK_LOAN);

      await service.create(LENDER_USER_ID, {
        item: inlineItem as never,
        borrowerId: BORROWER_ID,
        returnDate: '2099-06-01',
      });

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Item',
          category: ItemCategory.TOOLS,
          userId: LENDER_USER_ID,
        }),
      });
    });

    it('should throw 403 contact-not-accepted when no ACCEPTED invitation exists', async () => {
      contactInvitationsService.hasAcceptedContact.mockResolvedValue(false);
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
        expect(err.response.type).toContain('contact-not-accepted');
      }
    });

    it('should throw 403 contact-not-accepted when borrower has no userId', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue({
        ...MOCK_BORROWER,
        userId: null,
      });

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
        expect(err.response.type).toContain('contact-not-accepted');
      }
    });

    it('should throw 429 RateLimitException when daily limit exceeded', async () => {
      redisClient.get.mockResolvedValue('15');

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected RateLimitException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.response.type).toContain('daily-loan-limit-exceeded');
      }
    });

    it('should throw 404 when item UUID does not exist', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 when item belongs to another user', async () => {
      prisma.item.findUnique.mockResolvedValue({ ...MOCK_ITEM, userId: OTHER_USER_ID });

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('should throw 404 when borrower UUID does not exist', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue(null);

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 when borrower belongs to another user', async () => {
      prisma.item.findUnique.mockResolvedValue(MOCK_ITEM);
      prisma.borrower.findUnique.mockResolvedValue({
        ...MOCK_BORROWER,
        lenderUserId: OTHER_USER_ID,
      });

      try {
        await service.create(LENDER_USER_ID, CREATE_DTO);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });
  });

  // ===========================================================================
  // FIND ALL
  // ===========================================================================

  describe('findAll', () => {
    const DEFAULT_QUERY = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    it('should return paginated loans for lender', async () => {
      prisma.loan.findMany.mockResolvedValue([MOCK_LOAN]);
      prisma.loan.count.mockResolvedValue(1);

      const result = await service.findAll(LENDER_USER_ID, DEFAULT_QUERY);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lenderId: LENDER_USER_ID,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should filter by specific statuses', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.findAll(LENDER_USER_ID, {
        ...DEFAULT_QUERY,
        status: [LoanStatus.ACTIVE, LoanStatus.PENDING_CONFIRMATION],
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [LoanStatus.ACTIVE, LoanStatus.PENDING_CONFIRMATION] },
          }),
        }),
      );
    });

    it('should filter by borrowerId', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.findAll(LENDER_USER_ID, {
        ...DEFAULT_QUERY,
        borrowerId: BORROWER_ID,
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ borrowerId: BORROWER_ID }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(50);

      const result = await service.findAll(LENDER_USER_ID, {
        ...DEFAULT_QUERY,
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should return totalPages=0 when no results', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      const result = await service.findAll(LENDER_USER_ID, DEFAULT_QUERY);
      expect(result.pagination.totalPages).toBe(0);
    });

    // =========================================================================
    // INTEG-005 : findAll(role=borrower) — perspective emprunteur
    // =========================================================================
    it('should filter by borrower.userId when role=borrower (INTEG-005)', async () => {
      prisma.loan.findMany.mockResolvedValue([MOCK_LOAN]);
      prisma.loan.count.mockResolvedValue(1);

      const result = await service.findAll(BORROWER_USER_ID, {
        ...DEFAULT_QUERY,
        role: 'borrower',
      });

      expect(result.data).toHaveLength(1);
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borrower: { userId: BORROWER_USER_ID },
            deletedAt: null,
          }),
        }),
      );
      // Should NOT filter by lenderId when role=borrower
      const call = prisma.loan.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(call.where.lenderId).toBeUndefined();
    });

    // =========================================================================
    // INTEG-006 : findAll(role=borrower) + borrowerId — ignoré
    // =========================================================================
    it('should ignore borrowerId filter when role=borrower (INTEG-006)', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.findAll(BORROWER_USER_ID, {
        ...DEFAULT_QUERY,
        role: 'borrower',
        borrowerId: BORROWER_ID,
      });

      // borrowerId should NOT be in the where clause when role=borrower
      const call = prisma.loan.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(call.where.borrowerId).toBeUndefined();
    });
  });

  // ===========================================================================
  // FIND BY ID
  // ===========================================================================

  describe('findById', () => {
    it('should return a loan response', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      const result = await service.findById(LOAN_ID, LENDER_USER_ID);

      expect(result.id).toBe(LOAN_ID);
      expect(result.item.id).toBe(ITEM_ID);
      expect(result.borrower.id).toBe(BORROWER_ID);
    });

    it('should throw 404 when loan not found', async () => {
      prisma.loan.findUnique.mockResolvedValue(null);

      try {
        await service.findById(LOAN_ID, LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 404 when loan is soft-deleted', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        deletedAt: new Date(),
      });

      try {
        await service.findById(LOAN_ID, LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 when loan belongs to another user', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        lenderId: OTHER_USER_ID,
      });

      try {
        await service.findById(LOAN_ID, LENDER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    // =========================================================================
    // INTEG-007 : findById accessible par l'emprunteur
    // =========================================================================
    it('should return loan when accessed by borrower via resolveUserRole (INTEG-007)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      // BORROWER_USER_ID matches MOCK_BORROWER.userId
      const result = await service.findById(LOAN_ID, BORROWER_USER_ID);

      expect(result.id).toBe(LOAN_ID);
      expect(result.item.id).toBe(ITEM_ID);
      expect(result.borrower.id).toBe(BORROWER_ID);
    });

    // =========================================================================
    // INTEG-008 : findById par un tiers → 403
    // =========================================================================
    it('should throw 403 when third party (neither lender nor borrower) accesses loan (INTEG-008)', async () => {
      // OTHER_USER_ID is neither lenderId nor borrower.userId
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.findById(LOAN_ID, OTHER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('update', () => {
    it('should update loan fields', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        notes: 'Updated notes',
      });

      const result = await service.update(LOAN_ID, LENDER_USER_ID, { notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw 404 when loan not found', async () => {
      prisma.loan.findUnique.mockResolvedValue(null);

      try {
        await service.update(LOAN_ID, LENDER_USER_ID, { notes: 'test' });
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 when not the owner', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        lenderId: OTHER_USER_ID,
      });

      try {
        await service.update(LOAN_ID, LENDER_USER_ID, { notes: 'test' });
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    describe('return date lock (409 loan-return-date-locked)', () => {
      const inTenDays = (): string => {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() + 10);
        return date.toISOString().slice(0, 10);
      };

      const expectReturnDateLocked = async (promise: Promise<unknown>) => {
        try {
          await promise;
          fail('Expected ConflictException');
        } catch (error) {
          const err = error as { response: ProblemDetails };
          expect(err.response.status).toBe(HttpStatus.CONFLICT);
          expect(err.response.type).toBe('https://api.return.app/errors/loan-return-date-locked');
        }
      };

      it.each([
        LoanStatus.AWAITING_RETURN,
        LoanStatus.RETURNED,
        LoanStatus.NOT_RETURNED,
        LoanStatus.ABANDONED,
        LoanStatus.CONTESTED,
      ])('refuses to change the return date of a %s loan', async (status) => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status });

        await expectReturnDateLocked(
          service.update(LOAN_ID, LENDER_USER_ID, { returnDate: inTenDays() }),
        );
        expect(prisma.loan.update).not.toHaveBeenCalled();
        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });

      it('refuses to remove the return date of an overdue loan (it would never reach NOT_RETURNED)', async () => {
        prisma.loan.findUnique.mockResolvedValue({
          ...MOCK_LOAN,
          status: LoanStatus.AWAITING_RETURN,
        });

        await expectReturnDateLocked(service.update(LOAN_ID, LENDER_USER_ID, { returnDate: null }));
        expect(prisma.loan.update).not.toHaveBeenCalled();
      });

      it('still lets the lender edit the notes of a closed loan', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.RETURNED });
        prisma.loan.update.mockResolvedValue({
          ...MOCK_LOAN,
          status: LoanStatus.RETURNED,
          notes: 'n',
        });

        const result = await service.update(LOAN_ID, LENDER_USER_ID, { notes: 'n' });

        expect(result.notes).toBe('n');
        expect(prisma.loan.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: LOAN_ID } }),
        );
      });

      it('makes the date update conditional on the loan still being open', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        prisma.loan.update.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });

        await service.update(LOAN_ID, LENDER_USER_ID, { returnDate: inTenDays() });

        expect(prisma.loan.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: LOAN_ID,
              status: {
                in: [
                  LoanStatus.PENDING_CONFIRMATION,
                  LoanStatus.ACTIVE,
                  LoanStatus.ACTIVE_BY_DEFAULT,
                ],
              },
            },
          }),
        );
      });

      it('returns 409 when the loan stops being open between the read and the update (race)', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        prisma.loan.update.mockRejectedValue(
          Object.assign(new Error('Record to update not found.'), { code: 'P2025' }),
        );

        await expectReturnDateLocked(
          service.update(LOAN_ID, LENDER_USER_ID, { returnDate: inTenDays() }),
        );
        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });

      it('propagates any other database error', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        const dbError = Object.assign(new Error('connection lost'), { code: 'P1001' });
        prisma.loan.update.mockRejectedValue(dbError);

        await expect(
          service.update(LOAN_ID, LENDER_USER_ID, { returnDate: inTenDays() }),
        ).rejects.toBe(dbError);
      });
    });

    describe('return date change → reminders rescheduling', () => {
      const inDays = (days: number): string => {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
      };

      it.each([LoanStatus.PENDING_CONFIRMATION, LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT])(
        'emits RETURN_DATE_CHANGED when the return date of an open %s loan changes',
        async (status) => {
          const newDate = inDays(10);
          prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status });
          prisma.loan.update.mockResolvedValue({
            ...MOCK_LOAN,
            status,
            returnDate: new Date(newDate),
          });

          await service.update(LOAN_ID, LENDER_USER_ID, { returnDate: newDate });

          expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.RETURN_DATE_CHANGED, {
            loanId: LOAN_ID,
            returnDate: new Date(newDate),
            changedAt: expect.any(Date),
          });
        },
      );

      it('emits the date-only value stored on the loan when a datetime is sent', async () => {
        const day = inDays(10);
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        prisma.loan.update.mockResolvedValue({ ...MOCK_LOAN, returnDate: new Date(day) });

        await service.update(LOAN_ID, LENDER_USER_ID, { returnDate: `${day}T23:30:00+01:00` });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          LOAN_EVENTS.RETURN_DATE_CHANGED,
          expect.objectContaining({ returnDate: new Date(day) }),
        );
      });

      it('emits RETURN_DATE_CHANGED with a null date when the return date is removed', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        prisma.loan.update.mockResolvedValue({ ...MOCK_LOAN, returnDate: null });

        await service.update(LOAN_ID, LENDER_USER_ID, { returnDate: null });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          LOAN_EVENTS.RETURN_DATE_CHANGED,
          expect.objectContaining({ loanId: LOAN_ID, returnDate: null }),
        );
      });

      it('does not touch reminders when only the notes change', async () => {
        prisma.loan.findUnique.mockResolvedValue({ ...MOCK_LOAN, status: LoanStatus.ACTIVE });
        prisma.loan.update.mockResolvedValue({ ...MOCK_LOAN, notes: 'n' });

        await service.update(LOAN_ID, LENDER_USER_ID, { notes: 'n' });

        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });

      it('does not touch reminders when the return date is unchanged', async () => {
        const sameDate = inDays(10);
        const loan = { ...MOCK_LOAN, status: LoanStatus.ACTIVE, returnDate: new Date(sameDate) };
        prisma.loan.findUnique.mockResolvedValue(loan);
        prisma.loan.update.mockResolvedValue(loan);

        await service.update(LOAN_ID, LENDER_USER_ID, { returnDate: sameDate });

        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // DELETE (soft)
  // ===========================================================================

  describe('delete', () => {
    it('should soft-delete loan and emit DELETED event', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({ ...MOCK_LOAN, deletedAt: new Date() });

      await service.delete(LOAN_ID, LENDER_USER_ID);

      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: LOAN_ID },
        data: { deletedAt: expect.any(Date) },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.DELETED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        lastStatus: LoanStatus.PENDING_CONFIRMATION,
      });
    });

    it('should throw 409 when loan has RETURNED status', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.RETURNED,
      });

      try {
        await service.delete(LOAN_ID, LENDER_USER_ID);
        fail('Expected ConflictException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.CONFLICT);
        expect(err.response.type).toContain('loan-already-returned');
      }
    });

    it('should throw 404 when loan not found', async () => {
      prisma.loan.findUnique.mockResolvedValue(null);

      try {
        await service.delete(LOAN_ID, LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 when not the owner', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        lenderId: OTHER_USER_ID,
      });

      try {
        await service.delete(LOAN_ID, LENDER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });
  });

  // ===========================================================================
  // UPDATE STATUS
  // ===========================================================================

  describe('updateStatus', () => {
    it('should transition PENDING_CONFIRMATION → ACTIVE (borrower) and set confirmationDate', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
        confirmationDate: NOW,
      });

      const result = await service.updateStatus(LOAN_ID, BORROWER_USER_ID, LoanStatus.ACTIVE);

      expect(result.status).toBe(LoanStatus.ACTIVE);
      expect(prisma.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LoanStatus.ACTIVE,
            confirmationDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should transition ACTIVE → RETURNED (lender) and set returnedDate', async () => {
      const activeLoan = { ...MOCK_LOAN, status: LoanStatus.ACTIVE };
      prisma.loan.findUnique.mockResolvedValue(activeLoan);
      prisma.loan.update.mockResolvedValue({
        ...activeLoan,
        status: LoanStatus.RETURNED,
        returnedDate: NOW,
      });

      const result = await service.updateStatus(LOAN_ID, LENDER_USER_ID, LoanStatus.RETURNED);
      expect(result.status).toBe(LoanStatus.RETURNED);
    });

    it('should emit STATUS_CHANGED event with lender info from loan', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
      });

      await service.updateStatus(LOAN_ID, BORROWER_USER_ID, LoanStatus.ACTIVE);

      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.PENDING_CONFIRMATION,
        newStatus: LoanStatus.ACTIVE,
      });
    });

    it('should throw 409 for invalid transition', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.updateStatus(LOAN_ID, LENDER_USER_ID, LoanStatus.RETURNED);
        fail('Expected ConflictException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.CONFLICT);
        expect(err.response.type).toContain('invalid-status-transition');
      }
    });

    it('should throw 403 when role is not allowed for transition (lender tries PENDING→ACTIVE)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.updateStatus(LOAN_ID, LENDER_USER_ID, LoanStatus.ACTIVE);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
        expect(err.response.type).toContain('forbidden-status-transition');
      }
    });

    it('should throw 403 when user is neither lender nor borrower', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.updateStatus(LOAN_ID, OTHER_USER_ID, LoanStatus.ACTIVE);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('should include notes when provided', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
        notes: 'Confirmed by phone',
      });

      await service.updateStatus(
        LOAN_ID,
        BORROWER_USER_ID,
        LoanStatus.ACTIVE,
        'Confirmed by phone',
      );

      expect(prisma.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: 'Confirmed by phone' }),
        }),
      );
    });
  });

  // ===========================================================================
  // CONFIRM
  // ===========================================================================

  describe('confirm', () => {
    it('should transition to ACTIVE status (borrower only)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
        confirmationDate: NOW,
      });

      const result = await service.confirm(LOAN_ID, BORROWER_USER_ID);
      expect(result.status).toBe(LoanStatus.ACTIVE);
      expect(prisma.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LoanStatus.ACTIVE,
            confirmationDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should emit STATUS_CHANGED event on confirm', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
      });

      await service.confirm(LOAN_ID, BORROWER_USER_ID);

      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_USER_ID,
        previousStatus: LoanStatus.PENDING_CONFIRMATION,
        newStatus: LoanStatus.ACTIVE,
      });
    });

    it('should throw 409 when already active', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.ACTIVE,
      });

      try {
        await service.confirm(LOAN_ID, BORROWER_USER_ID);
        fail('Expected ConflictException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.CONFLICT);
      }
    });

    it('should throw 403 when lender tries to confirm (not borrower)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.confirm(LOAN_ID, LENDER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
        expect(err.response.type).toContain('forbidden-status-transition');
      }
    });
  });

  // ===========================================================================
  // CONTEST
  // ===========================================================================

  describe('contest', () => {
    it('should set status to CONTESTED and save reason (borrower only)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.CONTESTED,
        contestReason: 'This is not a valid loan because I never lent this item.',
      });

      const result = await service.contest(LOAN_ID, BORROWER_USER_ID, {
        reason: 'This is not a valid loan because I never lent this item.',
      });

      expect(result.status).toBe(LoanStatus.CONTESTED);
      expect(prisma.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LoanStatus.CONTESTED,
            contestReason: 'This is not a valid loan because I never lent this item.',
          }),
        }),
      );
    });

    it('should emit STATUS_CHANGED with CONTESTED', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);
      prisma.loan.update.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.CONTESTED,
      });

      await service.contest(LOAN_ID, BORROWER_USER_ID, {
        reason: 'This is not a valid loan because I never lent this item.',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        LOAN_EVENTS.STATUS_CHANGED,
        expect.objectContaining({ newStatus: LoanStatus.CONTESTED }),
      );
    });

    it('should throw 409 for invalid transition (e.g. RETURNED → CONTESTED)', async () => {
      prisma.loan.findUnique.mockResolvedValue({
        ...MOCK_LOAN,
        status: LoanStatus.RETURNED,
      });

      try {
        await service.contest(LOAN_ID, BORROWER_USER_ID, {
          reason: 'This is not a valid loan because I never lent this item.',
        });
        fail('Expected ConflictException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.CONFLICT);
      }
    });

    it('should throw 403 when lender tries to contest (not borrower)', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      try {
        await service.contest(LOAN_ID, LENDER_USER_ID, {
          reason: 'Not valid',
        });
        fail('Expected ForbiddenException');
      } catch (error) {
        const err = error as { response: ProblemDetails };
        expect(err.response.status).toBe(HttpStatus.FORBIDDEN);
        expect(err.response.type).toContain('forbidden-status-transition');
      }
    });
  });

  // ===========================================================================
  // RESPONSE MAPPING
  // ===========================================================================

  describe('toLoanResponse (via findById)', () => {
    it('should correctly map loan with all relations', async () => {
      prisma.loan.findUnique.mockResolvedValue(MOCK_LOAN);

      const result = await service.findById(LOAN_ID, LENDER_USER_ID);

      expect(result).toEqual({
        id: LOAN_ID,
        item: {
          id: ITEM_ID,
          name: 'Perceuse',
          description: 'Perceuse Bosch',
          category: ItemCategory.TOOLS,
          estimatedValue: 150,
          photos: [
            {
              id: PHOTO_ID,
              url: 'https://r2.example.com/photo.jpg',
              thumbnailUrl: 'https://r2.example.com/photo-thumb.jpg',
              uploadedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        lender: {
          id: LENDER_USER_ID,
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: null,
        },
        borrower: {
          id: BORROWER_ID,
          firstName: 'Marie',
          lastName: 'Dupont',
          email: 'marie@example.com',
          phoneNumber: '+33612345678',
          userId: BORROWER_USER_ID,
          statistics: {
            totalLoans: 0,
            returnedOnTime: 0,
            returnedLate: 0,
            notReturned: 0,
            averageReturnDelay: null,
            trustScore: 0,
          },
        },
        returnDate: '2025-06-01',
        status: LoanStatus.PENDING_CONFIRMATION,
        confirmationDate: null,
        returnedDate: null,
        notes: 'Test loan',
        contestReason: null,
        createdAt: '2025-02-27T12:00:00.000Z',
        updatedAt: '2025-02-27T12:00:00.000Z',
      });
    });
  });
});
