import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/problem-details.exception.js';
import {
  type BorrowerResponse,
  type BorrowerStatistics,
  type PaginatedBorrowersResponse,
} from './interfaces/borrower-response.interface.js';
import type { CreateBorrowerDto } from './dto/create-borrower.dto.js';
import type { UpdateBorrowerDto } from './dto/update-borrower.dto.js';
import type { Borrower } from '@prisma/client';
import { ACTIVE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';
import { TrustScoreService } from '../trust-score/trust-score.service.js';

// =============================================================================
// BorrowersService — Logique métier du module Borrowers
// =============================================================================

@Injectable()
export class BorrowersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(lenderUserId: string, dto: CreateBorrowerDto): Promise<BorrowerResponse> {
    // If a registered user already exists with this email, link immediately.
    // This handles the case where the contact is added AFTER the user has registered.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    try {
      const borrower = await this.prisma.borrower.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phoneNumber: dto.phoneNumber ?? null,
          lenderUserId,
          ...(existingUser && { userId: existingUser.id }),
        },
      });

      return this.toBorrowerResponse(borrower);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error, '/v1/borrowers');
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (paginated)
  // ---------------------------------------------------------------------------

  async findAll(
    lenderUserId: string,
    query: { sortBy: string; sortOrder: string; page: number; limit: number },
  ): Promise<PaginatedBorrowersResponse> {
    const { sortBy, sortOrder, page, limit } = query;
    const skip = (page - 1) * limit;

    const [borrowers, totalItems] = await Promise.all([
      this.prisma.borrower.findMany({
        where: { lenderUserId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.borrower.count({ where: { lenderUserId } }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data: borrowers.map((b) => this.toBorrowerResponse(b)),
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

  // ---------------------------------------------------------------------------
  // GET STATISTICS
  // ---------------------------------------------------------------------------

  async getStatistics(borrowerId: string, lenderUserId: string): Promise<BorrowerStatistics> {
    const borrower = await this.findBorrowerOrFail(borrowerId);
    this.assertOwnership(borrower, lenderUserId, `/v1/borrowers/${borrowerId}/statistics`);

    // FIX-15: trustScore is the GLOBAL score of the linked user (aggregated
    // across all lenders), not the per-relation value. The per-lender counters
    // below stay relative to this lender's history. A contact not yet linked to
    // an account (pending invitation) has no global score → 0.
    const trustScore = borrower.userId
      ? (await this.trustScoreService.computeGlobalTrustScore(borrower.userId)).trustScore
      : null;

    return {
      totalLoans: borrower.totalLoans,
      returnedOnTime: borrower.returnedOnTime,
      returnedLate: borrower.returnedLate,
      notReturned: borrower.notReturned,
      averageReturnDelay: borrower.averageReturnDelay,
      trustScore,
    };
  }

  // ---------------------------------------------------------------------------
  // FIND BY ID
  // ---------------------------------------------------------------------------

  async findById(borrowerId: string, lenderUserId: string): Promise<BorrowerResponse> {
    const borrower = await this.findBorrowerOrFail(borrowerId);
    this.assertOwnership(borrower, lenderUserId, `/v1/borrowers/${borrowerId}`);

    return this.toBorrowerResponse(borrower);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    borrowerId: string,
    lenderUserId: string,
    dto: UpdateBorrowerDto,
  ): Promise<BorrowerResponse> {
    const borrower = await this.findBorrowerOrFail(borrowerId);
    this.assertOwnership(borrower, lenderUserId, `/v1/borrowers/${borrowerId}`);

    try {
      const updated = await this.prisma.borrower.update({
        where: { id: borrowerId },
        data: dto,
      });

      return this.toBorrowerResponse(updated);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error, `/v1/borrowers/${borrowerId}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async delete(borrowerId: string, lenderUserId: string): Promise<void> {
    const borrower = await this.findBorrowerOrFail(borrowerId);
    this.assertOwnership(borrower, lenderUserId, `/v1/borrowers/${borrowerId}`);

    // LOAN-038: Cannot delete a borrower with active loans
    const activeLoanCount = await this.prisma.loan.count({
      where: {
        borrowerId,
        status: { in: ACTIVE_LOAN_STATUSES },
        deletedAt: null,
      },
    });
    if (activeLoanCount > 0) {
      throw new ConflictException(
        'active-loans-exist',
        'Active Loans Exist',
        'Cannot delete a borrower who has active loans.',
        `/v1/borrowers/${borrowerId}`,
      );
    }

    await this.prisma.borrower.delete({ where: { id: borrowerId } });
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private async findBorrowerOrFail(borrowerId: string): Promise<Borrower> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { id: borrowerId },
    });

    if (!borrower) {
      throw new NotFoundException('Borrower', borrowerId, `/v1/borrowers/${borrowerId}`);
    }

    return borrower;
  }

  private assertOwnership(borrower: Borrower, lenderUserId: string, path: string): void {
    if (borrower.lenderUserId !== lenderUserId) {
      throw new ForbiddenException(
        'forbidden',
        'Forbidden',
        'You do not have permission to access this borrower.',
        path,
      );
    }
  }

  private handleUniqueConstraintError(error: unknown, path: string): void {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as Error & { code: string }).code === 'P2002'
    ) {
      throw new ConflictException(
        'borrower-already-exists',
        'Borrower Already Exists',
        'A contact with this email already exists in your list.',
        path,
      );
    }
  }

  private toBorrowerResponse(borrower: Borrower): BorrowerResponse {
    return {
      id: borrower.id,
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      email: borrower.email,
      phoneNumber: borrower.phoneNumber,
      userId: borrower.userId,
      statistics: {
        totalLoans: borrower.totalLoans,
        returnedOnTime: borrower.returnedOnTime,
        returnedLate: borrower.returnedLate,
        notReturned: borrower.notReturned,
        averageReturnDelay: borrower.averageReturnDelay,
        trustScore: borrower.trustScore,
      },
    };
  }
}
