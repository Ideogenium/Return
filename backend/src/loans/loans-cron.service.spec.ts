import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoansCronService } from './loans-cron.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import { LoanStatus } from '@prisma/client';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const LOAN_ID_1 = '110e8400-e29b-41d4-a716-446655440001';
const LOAN_ID_2 = '110e8400-e29b-41d4-a716-446655440002';
const LOAN_ID_3 = '110e8400-e29b-41d4-a716-446655440003';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function buildLoan(
  id: string,
  ageHours: number,
  deltaDays: number | null,
): { id: string; borrowerId: string; lenderId: string; createdAt: Date; returnDate: Date | null } {
  const createdAt = new Date(Date.now() - ageHours * HOUR);
  return {
    id,
    borrowerId: BORROWER_ID,
    lenderId: LENDER_ID,
    createdAt,
    returnDate: deltaDays === null ? null : new Date(createdAt.getTime() + deltaDays * DAY),
  };
}

// =============================================================================
// Test Suite — LOAN-022 / LOAN-023
// =============================================================================

describe('LoansCronService', () => {
  let cronService: LoansCronService;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    cronService = module.get<LoansCronService>(LoansCronService);
  });

  describe('handlePendingTimeout', () => {
    it('logs one tick per run even when no loan is due, so the job is visible in production logs', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      prisma.loan.findMany.mockResolvedValue([]);

      await cronService.handlePendingTimeout();

      expect(log).toHaveBeenCalledWith('Pending-confirmation tick: 0 loan(s) to auto-confirm');
      log.mockRestore();
    });

    // FIX-05 vol. A: split auto-confirmation threshold by loan duration.
    // Short loans (Δ < 3 days) auto-confirm after 24h; longer loans after 48h.

    it('auto-confirms short loans (Δ<3) after 24h but not long loans (Δ≥3) before 48h', async () => {
      const shortReady = buildLoan(LOAN_ID_1, 25, 2); // Δ=2 → 24h threshold, age 25h → confirm
      const longTooYoung = buildLoan(LOAN_ID_2, 25, 10); // Δ=10 → 48h threshold, age 25h → skip
      const longReady = buildLoan(LOAN_ID_3, 49, 10); // Δ=10 → 48h threshold, age 49h → confirm

      prisma.loan.findMany.mockResolvedValue([shortReady, longTooYoung, longReady] as never);
      prisma.loan.updateMany.mockResolvedValue({ count: 2 });

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [LOAN_ID_1, LOAN_ID_3] } },
        data: {
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          confirmationDate: expect.any(Date),
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(LOAN_EVENTS.STATUS_CHANGED, {
        loanId: LOAN_ID_1,
        borrowerId: BORROWER_ID,
        lenderUserId: LENDER_ID,
        previousStatus: LoanStatus.PENDING_CONFIRMATION,
        newStatus: LoanStatus.ACTIVE_BY_DEFAULT,
      });
    });

    it('falls back to the 48h threshold when returnDate is null', async () => {
      const noDateYoung = buildLoan(LOAN_ID_1, 25, null); // no Δ → 48h, age 25h → skip
      const noDateOld = buildLoan(LOAN_ID_2, 49, null); // no Δ → 48h, age 49h → confirm

      prisma.loan.findMany.mockResolvedValue([noDateYoung, noDateOld] as never);
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [LOAN_ID_2] } },
        data: {
          status: LoanStatus.ACTIVE_BY_DEFAULT,
          confirmationDate: expect.any(Date),
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('queries PENDING candidates older than the shortest (24h) threshold', async () => {
      prisma.loan.findMany.mockResolvedValue([]);

      const before = Date.now();
      await cronService.handlePendingTimeout();
      const after = Date.now();

      const call = prisma.loan.findMany.mock.calls[0][0] as {
        where: { status: LoanStatus; createdAt: { lt: Date }; deletedAt: null };
        select: Record<string, boolean>;
      };

      expect(call.where.status).toBe(LoanStatus.PENDING_CONFIRMATION);
      expect(call.where.deletedAt).toBeNull();
      // returnDate & createdAt are needed to compute the per-loan threshold
      expect(call.select).toMatchObject({ createdAt: true, returnDate: true });

      const cutoffTime = call.where.createdAt.lt.getTime();
      const expected24h = 24 * 60 * 60 * 1000;
      expect(before - cutoffTime).toBeGreaterThanOrEqual(expected24h - 1000);
      expect(after - cutoffTime).toBeLessThanOrEqual(expected24h + 1000);
    });

    it('does nothing when no candidates exist', async () => {
      prisma.loan.findMany.mockResolvedValue([]);

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does nothing when candidates exist but none reached its threshold', async () => {
      const longTooYoung = buildLoan(LOAN_ID_1, 30, 10); // 48h threshold, age 30h → skip

      prisma.loan.findMany.mockResolvedValue([longTooYoung] as never);

      await cronService.handlePendingTimeout();

      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
