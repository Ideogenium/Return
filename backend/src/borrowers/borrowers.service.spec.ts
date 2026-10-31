import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { BorrowersService } from './borrowers.service.js';
import { TrustScoreService } from '../trust-score/trust-score.service.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';
import type { Borrower } from '@prisma/client';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '770e8400-e29b-41d4-a716-446655440000';

const MOCK_BORROWER: Borrower = {
  id: BORROWER_ID,
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie.dupont@example.com',
  phoneNumber: '+33612345678',
  userId: null,
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

const MOCK_BORROWER_2: Borrower = {
  id: '880e8400-e29b-41d4-a716-446655440000',
  firstName: 'Jean',
  lastName: 'Martin',
  email: 'jean.martin@example.com',
  phoneNumber: null,
  userId: null,
  lenderUserId: LENDER_USER_ID,
  trustScore: 0,
  totalLoans: 0,
  returnedOnTime: 0,
  returnedLate: 0,
  notReturned: 0,
  averageReturnDelay: null,
  createdAt: new Date('2025-01-02T00:00:00Z'),
  updatedAt: new Date('2025-01-02T00:00:00Z'),
};

// =============================================================================
// Test Suite
// =============================================================================

describe('BorrowersService', () => {
  let service: BorrowersService;
  let prisma: DeepMockProxy<PrismaService>;
  let trustScoreService: { computeGlobalTrustScore: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    trustScoreService = {
      computeGlobalTrustScore: jest.fn().mockResolvedValue({
        trustScore: 0,
        totalLoans: 0,
        returnedOnTime: 0,
        returnedLate: 0,
        notReturned: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BorrowersService,
        { provide: PrismaService, useValue: prisma },
        { provide: TrustScoreService, useValue: trustScoreService },
      ],
    }).compile();

    service = module.get<BorrowersService>(BorrowersService);
  });

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    it('should create a borrower without userId when no registered user matches the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.borrower.create.mockResolvedValue(MOCK_BORROWER);

      const result = await service.create(LENDER_USER_ID, {
        firstName: 'Marie',
        lastName: 'Dupont',
        email: 'marie.dupont@example.com',
        phoneNumber: '+33612345678',
      });

      expect(result.userId).toBeNull();
      expect(prisma.borrower.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Marie',
          lastName: 'Dupont',
          email: 'marie.dupont@example.com',
          phoneNumber: '+33612345678',
          lenderUserId: LENDER_USER_ID,
        },
      });
    });

    it('should create a borrower with userId when a registered user already has the same email', async () => {
      const REGISTERED_USER_ID = '990e8400-e29b-41d4-a716-446655440000';
      prisma.user.findUnique.mockResolvedValue({ id: REGISTERED_USER_ID } as never);
      prisma.borrower.create.mockResolvedValue({
        ...MOCK_BORROWER,
        userId: REGISTERED_USER_ID,
      });

      const result = await service.create(LENDER_USER_ID, {
        firstName: 'Marie',
        lastName: 'Dupont',
        email: 'marie.dupont@example.com',
        phoneNumber: '+33612345678',
      });

      expect(result.userId).toBe(REGISTERED_USER_ID);
      expect(prisma.borrower.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Marie',
          lastName: 'Dupont',
          email: 'marie.dupont@example.com',
          phoneNumber: '+33612345678',
          lenderUserId: LENDER_USER_ID,
          userId: REGISTERED_USER_ID,
        },
      });
    });

    it('should throw 409 Conflict if borrower email already exists for this lender', async () => {
      const prismaError = new Error('Unique constraint failed') as Error & {
        code: string;
        meta?: { target?: string[] };
      };
      prismaError.code = 'P2002';
      prismaError.meta = { target: ['lender_user_id', 'email'] };
      prisma.borrower.create.mockRejectedValue(prismaError);

      try {
        await service.create(LENDER_USER_ID, {
          firstName: 'Marie',
          lastName: 'Dupont',
          email: 'marie.dupont@example.com',
        });
        fail('Expected ConflictException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toBe('https://api.return.app/errors/borrower-already-exists');
        expect(body.title).toBe('Borrower Already Exists');
        expect(body.detail).toBe('A contact with this email already exists in your list.');
      }
    });
  });

  // ===========================================================================
  // FIND ALL (paginated)
  // ===========================================================================

  describe('findAll', () => {
    it('should return paginated borrowers with default statistics', async () => {
      prisma.borrower.findMany.mockResolvedValue([MOCK_BORROWER, MOCK_BORROWER_2]);
      prisma.borrower.count.mockResolvedValue(2);

      const result = await service.findAll(LENDER_USER_ID, {
        sortBy: 'firstName',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].firstName).toBe('Marie');
      expect(result.data[0].statistics).toEqual({
        totalLoans: 0,
        returnedOnTime: 0,
        returnedLate: 0,
        notReturned: 0,
        averageReturnDelay: null,
        trustScore: 0,
      });
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalItems: 2,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      expect(prisma.borrower.findMany).toHaveBeenCalledWith({
        where: { lenderUserId: LENDER_USER_ID },
        orderBy: { firstName: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle second page correctly', async () => {
      prisma.borrower.findMany.mockResolvedValue([MOCK_BORROWER_2]);
      prisma.borrower.count.mockResolvedValue(21);

      const result = await service.findAll(LENDER_USER_ID, {
        sortBy: 'lastName',
        sortOrder: 'desc',
        page: 2,
        limit: 20,
      });

      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 2,
        totalItems: 21,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPreviousPage: true,
      });

      expect(prisma.borrower.findMany).toHaveBeenCalledWith({
        where: { lenderUserId: LENDER_USER_ID },
        orderBy: { lastName: 'desc' },
        skip: 20,
        take: 20,
      });
    });

    it('should return empty data when no borrowers exist', async () => {
      prisma.borrower.findMany.mockResolvedValue([]);
      prisma.borrower.count.mockResolvedValue(0);

      const result = await service.findAll(LENDER_USER_ID, {
        sortBy: 'firstName',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should sort by trustScore (denormalized column)', async () => {
      prisma.borrower.findMany.mockResolvedValue([MOCK_BORROWER]);
      prisma.borrower.count.mockResolvedValue(1);

      await service.findAll(LENDER_USER_ID, {
        sortBy: 'trustScore',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });

      expect(prisma.borrower.findMany).toHaveBeenCalledWith({
        where: { lenderUserId: LENDER_USER_ID },
        orderBy: { trustScore: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should sort by totalLoans (denormalized column)', async () => {
      prisma.borrower.findMany.mockResolvedValue([MOCK_BORROWER]);
      prisma.borrower.count.mockResolvedValue(1);

      await service.findAll(LENDER_USER_ID, {
        sortBy: 'totalLoans',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      expect(prisma.borrower.findMany).toHaveBeenCalledWith({
        where: { lenderUserId: LENDER_USER_ID },
        orderBy: { totalLoans: 'asc' },
        skip: 0,
        take: 20,
      });
    });
  });

  // ===========================================================================
  // GET STATISTICS
  // ===========================================================================

  describe('getStatistics', () => {
    const LINKED_USER_ID = '990e8400-e29b-41d4-a716-446655440000';

    it('should return borrower statistics with defaults', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      const result = await service.getStatistics(BORROWER_ID, LENDER_USER_ID);

      expect(result).toEqual({
        totalLoans: 0,
        returnedOnTime: 0,
        returnedLate: 0,
        notReturned: 0,
        averageReturnDelay: null,
        trustScore: null,
      });
    });

    it('should use the GLOBAL trust score for a linked contact, with per-relation counters (FIX-15)', async () => {
      const linkedBorrower: Borrower = {
        ...MOCK_BORROWER,
        userId: LINKED_USER_ID,
        trustScore: 88, // per-relation value — must be ignored
        totalLoans: 12,
        returnedOnTime: 9,
      };
      prisma.borrower.findUnique.mockResolvedValue(linkedBorrower);
      trustScoreService.computeGlobalTrustScore.mockResolvedValue({
        trustScore: 73.5,
        totalLoans: 20,
        returnedOnTime: 14,
        returnedLate: 1,
        notReturned: 1,
      });

      const result = await service.getStatistics(BORROWER_ID, LENDER_USER_ID);

      // trustScore comes from the global aggregation of the linked user
      expect(trustScoreService.computeGlobalTrustScore).toHaveBeenCalledWith(LINKED_USER_ID);
      expect(result.trustScore).toBe(73.5);
      // counters stay relative to THIS lender's relationship
      expect(result.totalLoans).toBe(12);
      expect(result.returnedOnTime).toBe(9);
    });

    it('should report a null trustScore without aggregating for a pending (unlinked) contact', async () => {
      prisma.borrower.findUnique.mockResolvedValue({ ...MOCK_BORROWER, userId: null });

      const result = await service.getStatistics(BORROWER_ID, LENDER_USER_ID);

      expect(result.trustScore).toBeNull();
      expect(trustScoreService.computeGlobalTrustScore).not.toHaveBeenCalled();
    });

    it('should throw 404 if borrower does not exist', async () => {
      prisma.borrower.findUnique.mockResolvedValue(null);

      try {
        await service.getStatistics('nonexistent-id', LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
        expect(body.type).toContain('not-found');
      }
    });

    it('should throw 403 if borrower belongs to another user', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      try {
        await service.getStatistics(BORROWER_ID, OTHER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.FORBIDDEN);
        expect(body.type).toContain('forbidden');
      }
    });
  });

  // ===========================================================================
  // FIND BY ID
  // ===========================================================================

  describe('findById', () => {
    it('should return the borrower with default statistics', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      const result = await service.findById(BORROWER_ID, LENDER_USER_ID);

      expect(result.id).toBe(BORROWER_ID);
      expect(result.firstName).toBe('Marie');
      expect(result.statistics.totalLoans).toBe(0);
    });

    it('should map trustScore and totalLoans from database values', async () => {
      const borrowerWithStats: Borrower = {
        ...MOCK_BORROWER,
        trustScore: 88,
        totalLoans: 12,
      };
      prisma.borrower.findUnique.mockResolvedValue(borrowerWithStats);

      const result = await service.findById(BORROWER_ID, LENDER_USER_ID);

      expect(result.statistics.trustScore).toBe(88);
      expect(result.statistics.totalLoans).toBe(12);
      // Other stats remain at defaults (no loan detail columns yet)
      expect(result.statistics.returnedOnTime).toBe(0);
      expect(result.statistics.returnedLate).toBe(0);
      expect(result.statistics.notReturned).toBe(0);
      expect(result.statistics.averageReturnDelay).toBeNull();
    });

    it('should throw 404 if borrower does not exist', async () => {
      prisma.borrower.findUnique.mockResolvedValue(null);

      try {
        await service.findById('nonexistent-id', LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
        expect(body.type).toContain('not-found');
      }
    });

    it('should throw 403 if borrower belongs to another user', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      try {
        await service.findById(BORROWER_ID, OTHER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.FORBIDDEN);
        expect(body.type).toContain('forbidden');
      }
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('update', () => {
    it('should update and return the borrower', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      const updatedBorrower = { ...MOCK_BORROWER, firstName: 'Marie-Claire' };
      prisma.borrower.update.mockResolvedValue(updatedBorrower);

      const result = await service.update(BORROWER_ID, LENDER_USER_ID, {
        firstName: 'Marie-Claire',
      });

      expect(result.firstName).toBe('Marie-Claire');
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: { firstName: 'Marie-Claire' },
      });
    });

    it('should throw 404 if borrower does not exist', async () => {
      prisma.borrower.findUnique.mockResolvedValue(null);

      try {
        await service.update('nonexistent-id', LENDER_USER_ID, { firstName: 'X' });
        fail('Expected NotFoundException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 if borrower belongs to another user', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      try {
        await service.update(BORROWER_ID, OTHER_USER_ID, { firstName: 'X' });
        fail('Expected ForbiddenException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    // FIX-09: email is no longer part of UpdateBorrowerDto, so a borrower update
    // can never collide on the (lender_user_id, email) unique constraint.
    // The former "409 on updated email" test was removed as that path is now
    // unreachable — email immutability is covered by update-borrower.dto.spec.ts.
  });

  // ===========================================================================
  // DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should delete the borrower (204 scenario)', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.count.mockResolvedValue(0);
      prisma.borrower.delete.mockResolvedValue(MOCK_BORROWER);

      await service.delete(BORROWER_ID, LENDER_USER_ID);

      expect(prisma.borrower.delete).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
      });
    });

    it('should throw 404 if borrower does not exist', async () => {
      prisma.borrower.findUnique.mockResolvedValue(null);

      try {
        await service.delete('nonexistent-id', LENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 403 if borrower belongs to another user', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);

      try {
        await service.delete(BORROWER_ID, OTHER_USER_ID);
        fail('Expected ForbiddenException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    // NOTE: 409 active-loans-exist test will be added when Loans module is implemented.
    // For Sprint 2, borrowers have no active loans (no Loan model yet).

    it('should throw 409 if borrower has active loans (LOAN-038)', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.count.mockResolvedValue(1);

      try {
        await service.delete(BORROWER_ID, LENDER_USER_ID);
        fail('Expected ConflictException');
      } catch (error: unknown) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toContain('active-loans-exist');
      }
    });

    it('should allow deletion when borrower has no active loans', async () => {
      prisma.borrower.findUnique.mockResolvedValue(MOCK_BORROWER);
      prisma.loan.count.mockResolvedValue(0);
      prisma.borrower.delete.mockResolvedValue(MOCK_BORROWER);

      await service.delete(BORROWER_ID, LENDER_USER_ID);

      expect(prisma.borrower.delete).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
      });
    });
  });
});
