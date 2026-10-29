import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import type { HistoryStatistics } from './history.service.js';
import { LoanStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type {
  LoanResponse,
  PaginatedLoansResponse,
} from '../loans/interfaces/loan-response.interface.js';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';

const MOCK_AUTH_USER: AuthenticatedUser = {
  userId: LENDER_USER_ID,
  email: 'lender@example.com',
  role: 'LENDER',
  jti: 'jti-123',
  tokenExp: Math.floor(Date.now() / 1000) + 900,
};

const MOCK_LOAN_RESPONSE: LoanResponse = {
  id: LOAN_ID,
  item: {
    id: '220e8400-e29b-41d4-a716-446655440000',
    name: 'Perceuse',
    description: 'Perceuse Bosch',
    category: 'TOOLS',
    estimatedValue: 150,
    photos: [],
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  lender: {
    id: LENDER_USER_ID,
    firstName: 'John',
    lastName: 'Doe',
    profilePicture: null,
  },
  borrower: {
    id: '330e8400-e29b-41d4-a716-446655440000',
    firstName: 'Marie',
    lastName: 'Dupont',
    email: 'marie@example.com',
    phoneNumber: '+33612345678',
    userId: null,
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
  status: LoanStatus.RETURNED,
  confirmationDate: '2025-02-01T10:00:00.000Z',
  returnedDate: '2025-03-05T10:00:00.000Z',
  notes: 'Returned',
  contestReason: null,
  createdAt: '2025-02-27T12:00:00.000Z',
  updatedAt: '2025-02-27T12:00:00.000Z',
};

const MOCK_PAGINATED: PaginatedLoansResponse = {
  data: [MOCK_LOAN_RESPONSE],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const MOCK_STATISTICS: HistoryStatistics = {
  overview: {
    totalLoans: 10,
    activeLoans: 3,
    returnedLoans: 5,
    notReturnedLoans: 1,
    contestedLoans: 1,
    overdueLoans: 0,
    averageReturnDelay: 4,
  },
  byCategory: [{ category: 'TOOLS', count: 5, totalValue: 750 }],
  topBorrowers: [
    {
      borrower: {
        id: '330e8400-e29b-41d4-a716-446655440000',
        firstName: 'Marie',
        lastName: 'Dupont',
        profilePicture: null,
      },
      loanCount: 5,
      trustScore: 80,
    },
  ],
  mostLoanedItems: [
    {
      item: {
        id: '220e8400-e29b-41d4-a716-446655440000',
        name: 'Perceuse',
        description: 'Perceuse électrique polyvalente',
        category: 'TOOLS',
        estimatedValue: 250,
        photos: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      loanCount: 3,
    },
  ],
};

// =============================================================================
// Test Suite
// =============================================================================

describe('HistoryController', () => {
  let controller: HistoryController;
  let service: DeepMockProxy<HistoryService>;

  beforeEach(async () => {
    service = mockDeep<HistoryService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [{ provide: HistoryService, useValue: service }],
    }).compile();

    controller = module.get<HistoryController>(HistoryController);
  });

  // ===========================================================================
  // GET /v1/history/loans
  // ===========================================================================

  describe('getArchivedLoans', () => {
    it('should return paginated archived loans', async () => {
      service.getArchivedLoans.mockResolvedValue(MOCK_PAGINATED);
      const mockReq = { user: MOCK_AUTH_USER };

      const result = await controller.getArchivedLoans({}, mockReq as never);

      expect(result).toEqual(MOCK_PAGINATED);
      expect(service.getArchivedLoans).toHaveBeenCalledWith(LENDER_USER_ID, {});
    });

    it('should pass query parameters to the service', async () => {
      service.getArchivedLoans.mockResolvedValue(MOCK_PAGINATED);
      const mockReq = { user: MOCK_AUTH_USER };
      const query = {
        status: [LoanStatus.RETURNED],
        page: 2,
        limit: 10,
      };

      await controller.getArchivedLoans(query, mockReq as never);

      expect(service.getArchivedLoans).toHaveBeenCalledWith(LENDER_USER_ID, query);
    });
  });

  // ===========================================================================
  // GET /v1/history/statistics
  // ===========================================================================

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      service.getStatistics.mockResolvedValue(MOCK_STATISTICS);
      const mockReq = { user: MOCK_AUTH_USER };

      const result = await controller.getStatistics(mockReq as never);

      expect(result).toEqual(MOCK_STATISTICS);
      expect(service.getStatistics).toHaveBeenCalledWith(LENDER_USER_ID);
    });
  });
});
