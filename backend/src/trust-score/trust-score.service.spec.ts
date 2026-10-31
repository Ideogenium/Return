import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreService } from './trust-score.service.js';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustScoreService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TrustScoreService>(TrustScoreService);
  });

  describe('computeGlobalTrustScore', () => {
    it('computes the score over RESOLVED loans only, excluding in-progress/contested', async () => {
      // 20 total loans but only 10 resolved (7 on time + 2 late + 1 not returned);
      // the other 10 are in-progress or contested and must NOT weigh the score down.
      prisma.borrower.aggregate.mockResolvedValue({
        _sum: { totalLoans: 20, returnedOnTime: 7, returnedLate: 2, notReturned: 1 },
      } as never);

      const result = await service.computeGlobalTrustScore(USER_ID);

      expect(prisma.borrower.aggregate).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        _sum: {
          totalLoans: true,
          returnedOnTime: true,
          returnedLate: true,
          notReturned: true,
        },
      });
      // (7 * 100 + 2 * 50) / (7 + 2 + 1 resolved) = 800 / 10 = 80
      expect(result).toEqual({
        trustScore: 80,
        totalLoans: 20,
        returnedOnTime: 7,
        returnedLate: 2,
        notReturned: 1,
      });
    });

    it('returns null trustScore when there is no resolved loan (in-progress only)', async () => {
      prisma.borrower.aggregate.mockResolvedValue({
        _sum: { totalLoans: 4, returnedOnTime: 0, returnedLate: 0, notReturned: 0 },
      } as never);

      const result = await service.computeGlobalTrustScore(USER_ID);

      expect(result.trustScore).toBeNull();
      expect(result.totalLoans).toBe(4);
    });

    it('returns null trustScore when the user has no borrower records at all', async () => {
      prisma.borrower.aggregate.mockResolvedValue({
        _sum: { totalLoans: null, returnedOnTime: null, returnedLate: null, notReturned: null },
      } as never);

      const result = await service.computeGlobalTrustScore(USER_ID);

      expect(result).toEqual({
        trustScore: null,
        totalLoans: 0,
        returnedOnTime: 0,
        returnedLate: 0,
        notReturned: 0,
      });
    });

    it('rounds the trust score to one decimal', async () => {
      prisma.borrower.aggregate.mockResolvedValue({
        _sum: { totalLoans: 3, returnedOnTime: 1, returnedLate: 1, notReturned: 1 },
      } as never);

      const result = await service.computeGlobalTrustScore(USER_ID);

      // (100 + 50) / 3 resolved = 50 exactly
      expect(result.trustScore).toBe(50);
    });
  });
});
