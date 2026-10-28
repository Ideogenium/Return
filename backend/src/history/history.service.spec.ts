import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { HistoryService } from './history.service.js';
import { TERMINAL_STATUSES } from './dto/history-loans-query.dto.js';
import { LoanStatus, ItemCategory, UserRole } from '@prisma/client';
import type { Loan, Item, Photo, User, Borrower } from '@prisma/client';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
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
  trustScore: 80,
  totalLoans: 5,
  returnedOnTime: 4,
  returnedLate: 1,
  notReturned: 0,
  averageReturnDelay: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const NOW = new Date('2025-02-27T12:00:00Z');

const MOCK_RETURNED_LOAN: Loan & {
  item: Item & { photos: Photo[] };
  lender: User;
  borrower: Borrower;
} = {
  id: LOAN_ID,
  itemId: ITEM_ID,
  lenderId: LENDER_USER_ID,
  borrowerId: BORROWER_ID,
  status: LoanStatus.RETURNED,
  returnDate: new Date('2025-03-01'),
  confirmationDate: new Date('2025-02-01T10:00:00Z'),
  returnedDate: new Date('2025-03-05T10:00:00Z'),
  notes: 'Returned late',
  contestReason: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  item: { ...MOCK_ITEM, photos: [MOCK_PHOTO] },
  lender: MOCK_USER,
  borrower: MOCK_BORROWER,
};

// =============================================================================
// Test Suite
// =============================================================================

describe('HistoryService', () => {
  let service: HistoryService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [HistoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  // ===========================================================================
  // getArchivedLoans
  // ===========================================================================

  describe('getArchivedLoans', () => {
    it('should return paginated archived loans with no filters', async () => {
      prisma.loan.findMany.mockResolvedValue([MOCK_RETURNED_LOAN]);
      prisma.loan.count.mockResolvedValue(1);

      const result = await service.getArchivedLoans(LENDER_USER_ID, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(LOAN_ID);
      expect(result.data[0].status).toBe(LoanStatus.RETURNED);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      // Verify terminal statuses are applied by default
      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lenderId: LENDER_USER_ID,
            deletedAt: null,
            status: { in: TERMINAL_STATUSES },
          }),
        }),
      );
    });

    it('should filter by specific status', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.getArchivedLoans(LENDER_USER_ID, {
        status: [LoanStatus.RETURNED],
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [LoanStatus.RETURNED] },
          }),
        }),
      );
    });

    it('should filter by date range on createdAt', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.getArchivedLoans(LENDER_USER_ID, {
        startDate: '2025-01-01',
        endDate: '2025-06-30',
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2025-01-01'),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should filter by borrowerId', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      await service.getArchivedLoans(LENDER_USER_ID, {
        borrowerId: BORROWER_ID,
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borrowerId: BORROWER_ID,
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(50);

      const result = await service.getArchivedLoans(LENDER_USER_ID, {
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

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should return totalPages=0 when no results', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.loan.count.mockResolvedValue(0);

      const result = await service.getArchivedLoans(LENDER_USER_ID, {});

      expect(result.pagination.totalPages).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // ===========================================================================
  // getStatistics
  // ===========================================================================

  describe('getStatistics', () => {
    it('should return correct structure with data', async () => {
      // Overview counts
      prisma.loan.count
        .mockResolvedValueOnce(10) // totalLoans
        .mockResolvedValueOnce(3) // activeLoans
        .mockResolvedValueOnce(5) // returnedLoans
        .mockResolvedValueOnce(1) // notReturnedLoans
        .mockResolvedValueOnce(1); // contestedLoans

      // Returned loans for average delay
      prisma.loan.findMany.mockResolvedValueOnce([
        {
          returnDate: new Date('2025-03-01'),
          returnedDate: new Date('2025-03-05T10:00:00Z'),
        },
      ] as never);

      // byCategory
      prisma.loan.findMany.mockResolvedValueOnce([
        {
          ...MOCK_RETURNED_LOAN,
          item: { ...MOCK_ITEM, category: ItemCategory.TOOLS, estimatedValue: 150 },
        },
        {
          ...MOCK_RETURNED_LOAN,
          id: 'loan-2',
          item: { ...MOCK_ITEM, category: ItemCategory.TOOLS, estimatedValue: 50 },
        },
      ] as never);

      // topBorrowers
      prisma.loan.findMany.mockResolvedValueOnce([
        {
          ...MOCK_RETURNED_LOAN,
          borrower: { ...MOCK_BORROWER, user: MOCK_USER },
        },
      ] as never);

      // mostLoanedItems
      prisma.loan.findMany.mockResolvedValueOnce([MOCK_RETURNED_LOAN] as never);

      const result = await service.getStatistics(LENDER_USER_ID);

      // overview
      expect(result.overview.totalLoans).toBe(10);
      expect(result.overview.activeLoans).toBe(3);
      expect(result.overview.returnedLoans).toBe(5);
      expect(result.overview.notReturnedLoans).toBe(1);
      expect(result.overview.contestedLoans).toBe(1);
      expect(result.overview.averageReturnDelay).toBe(4); // 4 days

      // byCategory
      expect(result.byCategory).toHaveLength(1);
      expect(result.byCategory[0].category).toBe(ItemCategory.TOOLS);
      expect(result.byCategory[0].count).toBe(2);
      expect(result.byCategory[0].totalValue).toBe(200);

      // topBorrowers
      expect(result.topBorrowers).toHaveLength(1);
      expect(result.topBorrowers[0].borrower.id).toBe(BORROWER_ID);
      expect(result.topBorrowers[0].loanCount).toBe(1);
      expect(result.topBorrowers[0].trustScore).toBe(80);

      // mostLoanedItems
      expect(result.mostLoanedItems).toHaveLength(1);
      expect(result.mostLoanedItems[0].item.id).toBe(ITEM_ID);
      expect(result.mostLoanedItems[0].loanCount).toBe(1);
    });

    describe('overview.overdueLoans', () => {
      const overdueCountCall = () =>
        prisma.loan.count.mock.calls.find(
          ([args]) =>
            (args?.where as { returnDate?: unknown } | undefined)?.returnDate !== undefined,
        )?.[0];

      beforeEach(() => {
        prisma.loan.count.mockResolvedValue(0);
        prisma.loan.findMany.mockResolvedValue([]);
      });

      afterEach(() => jest.useRealTimers());

      it('counts open, non-deleted loans whose return date is strictly before today (UTC)', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
        jest.setSystemTime(new Date('2026-10-28T15:30:00Z'));

        await service.getStatistics(LENDER_USER_ID);

        expect(overdueCountCall()).toEqual({
          where: {
            lenderId: LENDER_USER_ID,
            deletedAt: null,
            status: {
              in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT, LoanStatus.AWAITING_RETURN],
            },
            returnDate: { lt: new Date('2026-10-28T00:00:00Z') },
          },
        });
      });

      it('treats a loan due today as on time: the cutoff is the start of the current UTC day', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
        jest.setSystemTime(new Date('2026-10-28T23:59:59Z'));

        await service.getStatistics(LENDER_USER_ID);

        const where = overdueCountCall()?.where as { returnDate: { lt: Date } };
        expect(where.returnDate.lt.toISOString()).toBe('2026-10-28T00:00:00.000Z');
      });

      it('excludes pending, contested and closed loans', async () => {
        await service.getStatistics(LENDER_USER_ID);

        const statuses = (overdueCountCall()?.where as { status: { in: LoanStatus[] } }).status.in;
        for (const excluded of [
          LoanStatus.PENDING_CONFIRMATION,
          LoanStatus.CONTESTED,
          LoanStatus.RETURNED,
          LoanStatus.NOT_RETURNED,
          LoanStatus.ABANDONED,
        ]) {
          expect(statuses).not.toContain(excluded);
        }
      });

      it('returns the overdue count in the overview', async () => {
        prisma.loan.count.mockImplementation(((args: { where?: { returnDate?: unknown } }) =>
          Promise.resolve(args?.where?.returnDate !== undefined ? 2 : 0)) as never);

        const result = await service.getStatistics(LENDER_USER_ID);

        expect(result.overview.overdueLoans).toBe(2);
      });
    });

    it('should return zeros when no loans exist', async () => {
      // Overview counts: all zeros
      prisma.loan.count.mockResolvedValue(0);

      // All findMany calls return empty arrays
      prisma.loan.findMany.mockResolvedValue([]);

      const result = await service.getStatistics(LENDER_USER_ID);

      expect(result.overview).toEqual({
        totalLoans: 0,
        activeLoans: 0,
        returnedLoans: 0,
        notReturnedLoans: 0,
        contestedLoans: 0,
        overdueLoans: 0,
        averageReturnDelay: 0,
      });
      expect(result.byCategory).toEqual([]);
      expect(result.topBorrowers).toEqual([]);
      expect(result.mostLoanedItems).toEqual([]);
    });

    it('should return 0 averageReturnDelay when no returned loans have returnDate', async () => {
      prisma.loan.count
        .mockResolvedValueOnce(5) // totalLoans
        .mockResolvedValueOnce(3) // activeLoans
        .mockResolvedValueOnce(0) // returnedLoans
        .mockResolvedValueOnce(1) // notReturnedLoans
        .mockResolvedValueOnce(1); // contestedLoans

      // No returned loans with returnDate
      prisma.loan.findMany.mockResolvedValueOnce([]);

      // byCategory, topBorrowers, mostLoanedItems
      prisma.loan.findMany.mockResolvedValue([]);

      const result = await service.getStatistics(LENDER_USER_ID);

      expect(result.overview.averageReturnDelay).toBe(0);
    });
  });
});
