import { Test, TestingModule } from '@nestjs/testing';
import { BorrowerStatsListener } from './borrower-stats.listener.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import type {
  LoanCreatedEvent,
  LoanStatusChangedEvent,
  LoanDeletedEvent,
} from '../common/events/loan.events.js';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

describe('BorrowerStatsListener', () => {
  let listener: BorrowerStatsListener;
  let prisma: DeepMockProxy<PrismaService>;

  const BORROWER_ID = '11111111-1111-1111-1111-111111111111';
  const LOAN_ID = '22222222-2222-2222-2222-222222222222';
  const LENDER_ID = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BorrowerStatsListener,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    listener = module.get<BorrowerStatsListener>(BorrowerStatsListener);
    prisma = module.get(PrismaService);
  });

  // =========================================================================
  // LOAN CREATED
  // =========================================================================
  describe(`@OnEvent(${LOAN_EVENTS.CREATED})`, () => {
    const event: LoanCreatedEvent = {
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_ID,
      returnDate: new Date('2026-04-15'),
      createdAt: new Date('2026-03-15'),
    };

    it('should increment totalLoans by 1', async () => {
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleLoanCreated(event);

      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: { totalLoans: { increment: 1 } },
      });
    });
  });

  // =========================================================================
  // STATUS CHANGED
  // =========================================================================
  describe(`@OnEvent(${LOAN_EVENTS.STATUS_CHANGED})`, () => {
    it('should recalculate all stats when status changes to RETURNED (all on-time)', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'AWAITING_RETURN',
        newStatus: 'RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 3 } as never);
      // 3 returned loans, all on-time (returnedDate <= returnDate)
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-08') },
        { returnDate: new Date('2025-03-15'), returnedDate: new Date('2025-03-15') },
        { returnDate: null, returnedDate: new Date('2025-03-20') }, // no deadline = on-time
      ] as never);
      prisma.loan.count.mockResolvedValue(0); // no NOT_RETURNED/ABANDONED
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 3,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: expect.any(Number),
          trustScore: 100, // (3*100 + 0*50) / 3 = 100
        },
      });
    });

    it('should compute mixed on-time/late stats with correct trustScore', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'AWAITING_RETURN',
        newStatus: 'RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 4 } as never);
      // 2 on-time, 1 late (3 days), 1 without deadline
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-09') }, // on-time
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-13') }, // 3 days late
        { returnDate: null, returnedDate: new Date('2025-03-20') }, // no deadline = on-time
      ] as never);
      prisma.loan.count.mockResolvedValue(1); // 1 NOT_RETURNED/ABANDONED
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      // returnedOnTime=2, returnedLate=1, notReturned=1
      // trustScore = (2*100 + 1*50) / 4 = 250/4 = 62.5
      // averageReturnDelay: (-1 + 3) / 2 = 1 → Math.round(1) = 1
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 2,
          returnedLate: 1,
          notReturned: 1,
          averageReturnDelay: 1,
          trustScore: 62.5,
        },
      });
    });

    it('should count a return on the due date (same calendar day) as on-time', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'AWAITING_RETURN',
        newStatus: 'RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 1 } as never);
      // Due at midnight, returned the SAME day at 14:00 → must be on-time, not late
      prisma.loan.findMany.mockResolvedValue([
        {
          returnDate: new Date('2025-03-10T00:00:00Z'),
          returnedDate: new Date('2025-03-10T14:00:00Z'),
        },
      ] as never);
      prisma.loan.count.mockResolvedValue(0);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 1,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: 0, // same day → 0 days (not ~0.6 rounded up to 1)
          trustScore: 100,
        },
      });
    });

    it('should recalculate stats when status changes to NOT_RETURNED', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'AWAITING_RETURN',
        newStatus: 'NOT_RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 4 } as never);
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-09') },
      ] as never);
      prisma.loan.count.mockResolvedValue(2);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      // resolved = 1 + 0 + 2 = 3 → trustScore = (1*100) / 3 = 33.3 (rounded)
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 1,
          returnedLate: 0,
          notReturned: 2,
          averageReturnDelay: expect.any(Number),
          trustScore: 33.3,
        },
      });
    });

    it('should recalculate stats when status changes to ABANDONED', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'ACTIVE',
        newStatus: 'ABANDONED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 2 } as never);
      prisma.loan.findMany.mockResolvedValue([] as never);
      prisma.loan.count.mockResolvedValue(1);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      // 0 returned, 1 abandoned → trustScore = 0/2 = 0
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 0,
          returnedLate: 0,
          notReturned: 1,
          averageReturnDelay: null,
          trustScore: 0,
        },
      });
    });

    it('should NOT recalculate for non-terminal status changes', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'PENDING_CONFIRMATION',
        newStatus: 'ACTIVE',
      };

      await listener.handleStatusChanged(event);

      expect(prisma.borrower.findUnique).not.toHaveBeenCalled();
      expect(prisma.borrower.update).not.toHaveBeenCalled();
    });

    it('should set trustScore to null when borrower has 0 totalLoans', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'ACTIVE',
        newStatus: 'RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 0 } as never);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          trustScore: null,
          returnedOnTime: 0,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: null,
        },
      });
    });

    it('should set averageReturnDelay to null when no loans have both dates', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'ACTIVE',
        newStatus: 'RETURNED',
      };

      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 2 } as never);
      // Loans with no returnDate → on-time, no delay computable
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: null, returnedDate: new Date('2025-03-10') },
        { returnDate: null, returnedDate: new Date('2025-03-15') },
      ] as never);
      prisma.loan.count.mockResolvedValue(0);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 2,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: null,
          trustScore: 100,
        },
      });
    });

    it('should compute trustScore over resolved loans only (excludes in-progress)', async () => {
      const event: LoanStatusChangedEvent = {
        loanId: LOAN_ID,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: 'AWAITING_RETURN',
        newStatus: 'RETURNED',
      };

      // totalLoans = 3 but only 2 are resolved (1 on-time + 1 late);
      // the 3rd is in-progress/contested and must not weigh the score down.
      prisma.borrower.findUnique.mockResolvedValue({ totalLoans: 3 } as never);
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-09') }, // on-time
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-12') }, // late
      ] as never);
      prisma.loan.count.mockResolvedValue(0);
      prisma.borrower.update.mockResolvedValue({} as never);

      await listener.handleStatusChanged(event);

      // resolved = 1 + 1 + 0 = 2 → trustScore = (100 + 50) / 2 = 75 (NOT /3)
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: expect.objectContaining({
          trustScore: 75,
        }),
      });
    });
  });

  // =========================================================================
  // LOAN DELETED
  // =========================================================================
  describe(`@OnEvent(${LOAN_EVENTS.DELETED})`, () => {
    const event: LoanDeletedEvent = {
      loanId: LOAN_ID,
      borrowerId: BORROWER_ID,
      lenderUserId: LENDER_ID,
      lastStatus: 'ACTIVE',
    };

    it('should decrement totalLoans and recalculate all stats', async () => {
      prisma.borrower.findUnique
        .mockResolvedValueOnce({ totalLoans: 3 } as never) // check > 0
        .mockResolvedValueOnce({ totalLoans: 2 } as never); // recalculate
      prisma.borrower.update.mockResolvedValue({} as never);
      prisma.loan.findMany.mockResolvedValue([
        { returnDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-09') },
      ] as never);
      prisma.loan.count.mockResolvedValue(0);

      await listener.handleLoanDeleted(event);

      // First update: decrement
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: { totalLoans: { decrement: 1 } },
      });

      // Second update: full stats recalculation
      // resolved = 1 + 0 + 0 = 1 → trustScore = (1*100) / 1 = 100 (the 2nd loan is in-progress)
      expect(prisma.borrower.update).toHaveBeenCalledWith({
        where: { id: BORROWER_ID },
        data: {
          returnedOnTime: 1,
          returnedLate: 0,
          notReturned: 0,
          averageReturnDelay: expect.any(Number),
          trustScore: 100,
        },
      });
    });

    it('should NOT decrement when totalLoans is already 0', async () => {
      prisma.borrower.findUnique.mockResolvedValue({
        totalLoans: 0,
      } as never);

      await listener.handleLoanDeleted(event);

      expect(prisma.borrower.update).not.toHaveBeenCalled();
    });

    it('should NOT decrement when borrower is not found', async () => {
      prisma.borrower.findUnique.mockResolvedValue(null);

      await listener.handleLoanDeleted(event);

      expect(prisma.borrower.update).not.toHaveBeenCalled();
    });
  });
});
