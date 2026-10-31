import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Global trust score of a user acting as a borrower, aggregated across every
 * lender who has a contact (Borrower) record pointing at that user.
 */
export interface GlobalTrustScore {
  /** null = not yet rated (no resolved loan). */
  trustScore: number | null;
  totalLoans: number;
  returnedOnTime: number;
  returnedLate: number;
  notReturned: number;
}

/**
 * FIX-15: single source of truth for a user's trust score.
 *
 * The per-relation `trustScore` denormalized on each Borrower record is local to
 * one lender. A user borrowing from several lenders has several Borrower records,
 * each with its own score. This service aggregates the (linear) denormalized
 * counters across all of them to produce one global score, used both on the
 * user's own profile (GET /users/me/trust-score) and on a contact sheet
 * (GET /borrowers/{id}/statistics).
 */
@Injectable()
export class TrustScoreService {
  constructor(private readonly prisma: PrismaService) {}

  async computeGlobalTrustScore(userId: string): Promise<GlobalTrustScore> {
    const { _sum } = await this.prisma.borrower.aggregate({
      where: { userId },
      _sum: {
        totalLoans: true,
        returnedOnTime: true,
        returnedLate: true,
        notReturned: true,
      },
    });

    const totalLoans = _sum.totalLoans ?? 0;
    const returnedOnTime = _sum.returnedOnTime ?? 0;
    const returnedLate = _sum.returnedLate ?? 0;
    const notReturned = _sum.notReturned ?? 0;

    // Denominator = RESOLVED loans only (returned on time / late / not returned).
    // CONTESTED and in-progress loans are excluded — they must not weigh the
    // score down. No resolved loan yet → null ("not yet rated").
    const resolved = returnedOnTime + returnedLate + notReturned;
    const trustScore =
      resolved > 0
        ? Math.round(((returnedOnTime * 100 + returnedLate * 50) / resolved) * 10) / 10
        : null;

    return { trustScore, totalLoans, returnedOnTime, returnedLate, notReturned };
  }
}
