import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { HistoryLoansQueryDto } from './dto/history-loans-query.dto.js';
import { TERMINAL_STATUSES } from './dto/history-loans-query.dto.js';
import type { PaginatedLoansResponse } from '../loans/interfaces/loan-response.interface.js';
import type { PhotoResponse } from '../items/interfaces/photo-response.interface.js';
import {
  toLoanResponse,
  toPhotoResponse,
  type LoanWithRelations,
} from '../common/mappers/loan-response.mapper.js';
import { startOfUtcDay } from '../common/utils/date.util.js';
import { LoanStatus } from '@prisma/client';

/** Active statuses used for overview counting */
const ACTIVE_STATUSES: LoanStatus[] = [
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
  LoanStatus.AWAITING_RETURN,
  LoanStatus.PENDING_CONFIRMATION,
];

/** Started, still-open statuses: the only ones that can be overdue */
const OVERDUE_CANDIDATE_STATUSES: LoanStatus[] = [
  LoanStatus.ACTIVE,
  LoanStatus.ACTIVE_BY_DEFAULT,
  LoanStatus.AWAITING_RETURN,
];

// =========================================================================
// Response interfaces for statistics
// =========================================================================

export interface HistoryOverview {
  totalLoans: number;
  activeLoans: number;
  returnedLoans: number;
  notReturnedLoans: number;
  contestedLoans: number;
  /** Open loans past their return date; also counted in activeLoans */
  overdueLoans: number;
  averageReturnDelay: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  totalValue: number | null;
}

export interface TopBorrower {
  borrower: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
  loanCount: number;
  /** null = pas encore noté (aucun prêt résolu). */
  trustScore: number | null;
}

export interface MostLoanedItem {
  item: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    estimatedValue: number | null;
    photos: PhotoResponse[];
    createdAt: string;
  };
  loanCount: number;
}

export interface HistoryStatistics {
  overview: HistoryOverview;
  byCategory: CategoryStats[];
  topBorrowers: TopBorrower[];
  mostLoanedItems: MostLoanedItem[];
}

// =========================================================================
// Service
// =========================================================================

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  // =======================================================================
  // GET /history/loans — Archived loans with filters & pagination
  // =======================================================================

  async getArchivedLoans(
    userId: string,
    query: HistoryLoansQueryDto,
  ): Promise<PaginatedLoansResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      lenderId: userId,
      deletedAt: null,
    };

    // Restrict to terminal statuses; optionally narrow further
    if (query.status && query.status.length > 0) {
      // Only allow terminal statuses that are also in the user's filter
      const filtered = query.status.filter((s) => (TERMINAL_STATUSES as string[]).includes(s));
      where.status = { in: filtered.length > 0 ? filtered : TERMINAL_STATUSES };
    } else {
      where.status = { in: TERMINAL_STATUSES };
    }

    if (query.borrowerId) {
      where.borrowerId = query.borrowerId;
    }

    // Date range filter on createdAt
    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) {
        createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    const [loans, totalItems] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        include: {
          item: { include: { photos: true } },
          lender: true,
          borrower: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.loan.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data: loans.map((loan) => toLoanResponse(loan as LoanWithRelations)),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // =======================================================================
  // GET /history/statistics — Aggregated statistics for current user
  // =======================================================================

  async getStatistics(userId: string): Promise<HistoryStatistics> {
    const [overview, byCategory, topBorrowers, mostLoanedItems] = await Promise.all([
      this.computeOverview(userId),
      this.computeByCategory(userId),
      this.computeTopBorrowers(userId),
      this.computeMostLoanedItems(userId),
    ]);

    return { overview, byCategory, topBorrowers, mostLoanedItems };
  }

  // =======================================================================
  // Private: Overview
  // =======================================================================

  private async computeOverview(userId: string): Promise<HistoryOverview> {
    const baseWhere = { lenderId: userId, deletedAt: null };

    const [
      totalLoans,
      activeLoans,
      returnedLoans,
      notReturnedLoans,
      contestedLoans,
      returnedLoansData,
      overdueLoans,
    ] = await Promise.all([
      this.prisma.loan.count({ where: baseWhere }),
      this.prisma.loan.count({
        where: { ...baseWhere, status: { in: ACTIVE_STATUSES } },
      }),
      this.prisma.loan.count({
        where: { ...baseWhere, status: LoanStatus.RETURNED },
      }),
      this.prisma.loan.count({
        where: { ...baseWhere, status: LoanStatus.NOT_RETURNED },
      }),
      this.prisma.loan.count({
        where: { ...baseWhere, status: LoanStatus.CONTESTED },
      }),
      // Fetch returned loans to compute average delay
      this.prisma.loan.findMany({
        where: { ...baseWhere, status: LoanStatus.RETURNED, returnDate: { not: null } },
        select: { returnDate: true, returnedDate: true },
      }),
      this.prisma.loan.count({
        where: {
          ...baseWhere,
          status: { in: OVERDUE_CANDIDATE_STATUSES },
          returnDate: { lt: startOfUtcDay(new Date()) },
        },
      }),
    ]);

    let averageReturnDelay: number = 0;
    if (returnedLoansData.length > 0) {
      let totalDays = 0;
      let validCount = 0;

      for (const loan of returnedLoansData) {
        if (loan.returnDate && loan.returnedDate) {
          const returnDate = new Date(loan.returnDate);
          const returnedDate = new Date(loan.returnedDate);
          const diffMs = returnedDate.getTime() - returnDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          totalDays += diffDays;
          validCount++;
        }
      }

      if (validCount > 0) {
        averageReturnDelay = Math.round((totalDays / validCount) * 10) / 10;
      }
    }

    return {
      totalLoans,
      activeLoans,
      returnedLoans,
      notReturnedLoans,
      contestedLoans,
      overdueLoans,
      averageReturnDelay,
    };
  }

  // =======================================================================
  // Private: By Category
  // =======================================================================

  private async computeByCategory(userId: string): Promise<CategoryStats[]> {
    const loans = await this.prisma.loan.findMany({
      where: { lenderId: userId, deletedAt: null },
      select: { item: { select: { category: true, estimatedValue: true } } },
    });

    const categoryMap = new Map<string, { count: number; totalValue: number | null }>();

    for (const loan of loans) {
      const category = loan.item.category;
      const existing = categoryMap.get(category);

      if (existing) {
        existing.count++;
        if (loan.item.estimatedValue !== null) {
          existing.totalValue = (existing.totalValue ?? 0) + loan.item.estimatedValue;
        }
      } else {
        categoryMap.set(category, {
          count: 1,
          totalValue: loan.item.estimatedValue,
        });
      }
    }

    return Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      totalValue: stats.totalValue,
    }));
  }

  // =======================================================================
  // Private: Top Borrowers
  // =======================================================================

  private async computeTopBorrowers(userId: string): Promise<TopBorrower[]> {
    const loans = await this.prisma.loan.findMany({
      where: { lenderId: userId, deletedAt: null },
      select: {
        borrowerId: true,
        borrower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            trustScore: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const borrowerMap = new Map<
      string,
      {
        borrower: (typeof loans)[number]['borrower'];
        count: number;
      }
    >();

    for (const loan of loans) {
      const existing = borrowerMap.get(loan.borrowerId);
      if (existing) {
        existing.count++;
      } else {
        borrowerMap.set(loan.borrowerId, {
          borrower: loan.borrower,
          count: 1,
        });
      }
    }

    const sorted = Array.from(borrowerMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted.map(({ borrower, count }) => ({
      borrower: {
        id: borrower.id,
        firstName: borrower.user?.firstName ?? borrower.firstName,
        lastName: borrower.user?.lastName ?? borrower.lastName,
        profilePicture: borrower.user?.profilePicture ?? null,
      },
      loanCount: count,
      trustScore: borrower.trustScore,
    }));
  }

  // =======================================================================
  // Private: Most Loaned Items
  // =======================================================================

  private async computeMostLoanedItems(userId: string): Promise<MostLoanedItem[]> {
    const loans = await this.prisma.loan.findMany({
      where: { lenderId: userId, deletedAt: null },
      select: {
        itemId: true,
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            estimatedValue: true,
            createdAt: true,
            photos: {
              select: { id: true, itemId: true, url: true, thumbnailUrl: true, uploadedAt: true },
            },
          },
        },
      },
    });

    const itemMap = new Map<
      string,
      {
        item: (typeof loans)[number]['item'];
        count: number;
      }
    >();

    for (const loan of loans) {
      const existing = itemMap.get(loan.itemId);
      if (existing) {
        existing.count++;
      } else {
        itemMap.set(loan.itemId, {
          item: loan.item,
          count: 1,
        });
      }
    }

    const sorted = Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted.map(({ item, count }) => ({
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        estimatedValue: item.estimatedValue,
        photos: item.photos.map((p) => toPhotoResponse(p)),
        createdAt: item.createdAt.toISOString(),
      },
      loanCount: count,
    }));
  }
}
