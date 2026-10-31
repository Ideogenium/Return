import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  RateLimitException,
} from '../common/exceptions/problem-details.exception.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import {
  ACTIVE_LOAN_STATUSES,
  RETURN_DATE_RESCHEDULABLE_STATUSES,
} from '../common/constants/loan-statuses.js';
import { isValidTransition, isAllowedForRole } from './loan-status-machine.js';
import type { LoanRole } from './loan-status-machine.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import type { UpdateLoanDto } from './dto/update-loan.dto.js';
import type { ContestLoanDto } from './dto/contest-loan.dto.js';
import type { CreateItemDto } from '../items/dto/create-item.dto.js';
import { ContactInvitationsService } from '../contact-invitations/contact-invitations.service.js';
import type { LoanResponse, PaginatedLoansResponse } from './interfaces/loan-response.interface.js';
import {
  LOAN_INCLUDE,
  toLoanResponse,
  type LoanWithRelations,
} from '../common/mappers/loan-response.mapper.js';
import type {
  LoanCreatedEvent,
  LoanStatusChangedEvent,
  LoanDeletedEvent,
  LoanReturnDateChangedEvent,
} from '../common/events/loan.events.js';
import { isPrismaRecordNotFoundError } from '../common/utils/prisma-errors.util.js';
import { startOfUtcDay } from '../common/utils/date.util.js';
import { LoanStatus, Prisma } from '@prisma/client';

const MAX_LOANS_PER_DAY = 15;

/** Earliest accepted return date: J+2 counted on UTC calendar days (returnDate is a @db.Date). */
function minimumReturnDate(startOfToday: Date): Date {
  const minimum = new Date(startOfToday);
  minimum.setUTCDate(minimum.getUTCDate() + 2);
  return minimum;
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/** Transaction client type for Prisma interactive transactions */
type TxClient = Prisma.TransactionClient;

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly contactInvitationsService: ContactInvitationsService,
  ) {}

  // =========================================================================
  // CREATE
  // =========================================================================

  async create(lenderId: string, dto: CreateLoanDto): Promise<LoanResponse> {
    // Rate limit: 15 loans/day
    await this.checkDailyRateLimit(lenderId);

    // Validate returnDate if provided
    if (dto.returnDate) {
      const returnDate = new Date(dto.returnDate);
      const today = startOfUtcDay(new Date());
      if (returnDate < today) {
        throw new BadRequestException(
          'invalid-return-date',
          'Invalid Return Date',
          'Return date must be in the future.',
          '/v1/loans',
        );
      }
      if (returnDate < minimumReturnDate(today)) {
        throw new BadRequestException(
          'return-date-too-soon',
          'Return Date Too Soon',
          'Return date must be at least 2 days from now.',
          '/v1/loans',
        );
      }
    }

    // Atomic transaction: resolve/create item + resolve borrower + loan in one go
    // Prevents orphaned records if any step fails
    const loan = await this.prisma.$transaction(async (tx) => {
      const itemId = await this.resolveItem(tx, dto.item, lenderId);

      // FIX-04: an item can only be lent once at a time. Reject if it already
      // has a loan in an active status (a freshly created inline item never does).
      const activeLoan = await tx.loan.findFirst({
        where: {
          itemId,
          status: { in: ACTIVE_LOAN_STATUSES },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (activeLoan) {
        throw new ConflictException(
          'item-already-loaned',
          'Item Already Loaned',
          'This item already has an active loan and cannot be lent again until it is returned.',
          '/v1/loans',
        );
      }

      const borrowerId = await this.resolveBorrower(tx, dto.borrowerId, lenderId);

      // CINV-019: Verify ACCEPTED contact invitation exists for this borrower.
      // All borrowers MUST have a userId (linked via invitation acceptance).
      // Borrowers without userId are not valid for loan creation.
      const borrower = await tx.borrower.findUnique({
        where: { id: borrowerId },
        select: { userId: true },
      });
      if (!borrower?.userId) {
        throw new ForbiddenException(
          'contact-not-accepted',
          'Contact Not Accepted',
          'You can only create a loan for a contact with an ACCEPTED invitation.',
          '/v1/loans',
        );
      }

      const hasAccepted = await this.contactInvitationsService.hasAcceptedContact(
        lenderId,
        borrower.userId,
      );
      if (!hasAccepted) {
        throw new ForbiddenException(
          'contact-not-accepted',
          'Contact Not Accepted',
          'You can only create a loan for a contact with an ACCEPTED invitation.',
          '/v1/loans',
        );
      }

      return tx.loan.create({
        data: {
          itemId,
          lenderId,
          borrowerId,
          status: LoanStatus.PENDING_CONFIRMATION,
          returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
          notes: dto.notes ?? null,
        },
        include: LOAN_INCLUDE,
      });
    });

    // Increment daily counter (outside transaction — Redis, not Prisma)
    await this.incrementDailyCount(lenderId);

    // Emit event for inter-module communication (outside transaction)
    const event: LoanCreatedEvent = {
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      lenderUserId: lenderId,
      returnDate: loan.returnDate,
      createdAt: loan.createdAt,
    };
    this.eventEmitter.emit(LOAN_EVENTS.CREATED, event);

    return toLoanResponse(loan, lenderId);
  }

  // =========================================================================
  // READ
  // =========================================================================

  async findAll(
    userId: string,
    query: {
      role?: 'lender' | 'borrower';
      status?: LoanStatus[];
      borrowerId?: string;
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: string;
    },
  ): Promise<PaginatedLoansResponse> {
    const { page, limit, sortBy, sortOrder, borrowerId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (query.role === 'borrower') {
      where.borrower = { userId };
      // Per the OpenAPI contract, borrowerId is ignored when role=borrower:
      // the current user is already the borrower, so no additional borrower filter is applied.
    } else {
      where.lenderId = userId;

      // borrowerId filter is only honored in the lender perspective (role=lender).
      if (borrowerId) {
        where.borrowerId = borrowerId;
      }
    }

    // Status filter
    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }

    const [loans, totalItems] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        include: LOAN_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.loan.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data: loans.map((loan) => toLoanResponse(loan as LoanWithRelations, userId)),
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

  async findById(loanId: string, userId: string): Promise<LoanResponse> {
    const loan = await this.findLoanOrFail(loanId);
    this.resolveUserRole(loan, userId);
    return toLoanResponse(loan, userId);
  }

  /**
   * Returns all loans for a given borrower belonging to the authenticated lender.
   * Used by GET /borrowers/:borrowerId/loans (unpaginated array).
   */
  async findByBorrower(
    borrowerId: string,
    lenderId: string,
    statusFilter?: LoanStatus[],
  ): Promise<LoanResponse[]> {
    const where: Record<string, unknown> = {
      borrowerId,
      lenderId,
      deletedAt: null,
    };

    if (statusFilter && statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }

    const loans = await this.prisma.loan.findMany({
      where,
      include: LOAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return loans.map((loan) => toLoanResponse(loan as LoanWithRelations, lenderId));
  }

  // =========================================================================
  // UPDATE
  // =========================================================================

  async update(loanId: string, lenderId: string, dto: UpdateLoanDto): Promise<LoanResponse> {
    const loan = await this.findLoanOrFail(loanId);
    this.assertOwnership(loan, lenderId, `/v1/loans/${loanId}`);

    const data: Record<string, unknown> = {};
    let newReturnDate: Date | null | undefined;
    if (dto.returnDate !== undefined) {
      if (!RETURN_DATE_RESCHEDULABLE_STATUSES.includes(loan.status)) {
        throw this.returnDateLockedException(loanId);
      }
      if (dto.returnDate) {
        const returnDate = new Date(dto.returnDate);
        if (returnDate < minimumReturnDate(startOfUtcDay(new Date()))) {
          throw new BadRequestException(
            'return-date-too-soon',
            'Return Date Too Soon',
            'Return date must be at least 2 days from now.',
            `/v1/loans/${loanId}`,
          );
        }
        newReturnDate = returnDate;
      } else {
        newReturnDate = null;
      }
      data.returnDate = newReturnDate;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    let updated: LoanWithRelations;
    try {
      updated = (await this.prisma.loan.update({
        // The status filter closes the race with a concurrent return or overdue transition.
        where:
          newReturnDate === undefined
            ? { id: loanId }
            : { id: loanId, status: { in: RETURN_DATE_RESCHEDULABLE_STATUSES } },
        data,
        include: LOAN_INCLUDE,
      })) as LoanWithRelations;
    } catch (error) {
      if (newReturnDate !== undefined && isPrismaRecordNotFoundError(error)) {
        throw this.returnDateLockedException(loanId);
      }
      throw error;
    }

    if (newReturnDate !== undefined && !sameDay(loan.returnDate, newReturnDate)) {
      const event: LoanReturnDateChangedEvent = {
        loanId,
        // Stored value: @db.Date drops any time part sent by the client.
        returnDate: updated.returnDate,
        changedAt: new Date(),
      };
      this.eventEmitter.emit(LOAN_EVENTS.RETURN_DATE_CHANGED, event);
    }

    return toLoanResponse(updated, lenderId);
  }

  private returnDateLockedException(loanId: string): ConflictException {
    return new ConflictException(
      'loan-return-date-locked',
      'Return Date Locked',
      'The return date can only be changed while the loan is pending or active.',
      `/v1/loans/${loanId}`,
    );
  }

  // =========================================================================
  // DELETE (soft)
  // =========================================================================

  async delete(loanId: string, lenderId: string): Promise<void> {
    const loan = await this.findLoanOrFail(loanId);
    this.assertOwnership(loan, lenderId, `/v1/loans/${loanId}`);

    if (loan.status === LoanStatus.RETURNED) {
      throw new ConflictException(
        'loan-already-returned',
        'Cannot Delete Returned Loan',
        'You cannot delete a loan that has already been returned.',
        `/v1/loans/${loanId}`,
      );
    }

    await this.prisma.loan.update({
      where: { id: loanId },
      data: { deletedAt: new Date() },
    });

    const event: LoanDeletedEvent = {
      loanId,
      borrowerId: loan.borrowerId,
      lenderUserId: lenderId,
      lastStatus: loan.status,
    };
    this.eventEmitter.emit(LOAN_EVENTS.DELETED, event);
  }

  // =========================================================================
  // STATUS TRANSITIONS
  // =========================================================================

  async updateStatus(
    loanId: string,
    userId: string,
    newStatus: LoanStatus,
    notes?: string | null,
  ): Promise<LoanResponse> {
    const loan = await this.findLoanOrFail(loanId);

    // Determine user role relative to this loan (lender or borrower)
    const role = this.resolveUserRole(loan, userId);

    if (!isValidTransition(loan.status, newStatus)) {
      throw new ConflictException(
        'invalid-status-transition',
        'Invalid Status Transition',
        `Cannot transition from ${loan.status} to ${newStatus}.`,
        `/v1/loans/${loanId}/status`,
      );
    }

    if (!isAllowedForRole(loan.status, newStatus, role)) {
      throw new ForbiddenException(
        'forbidden-status-transition',
        'Forbidden Status Transition',
        'This status transition is not allowed for your role.',
        `/v1/loans/${loanId}/status`,
      );
    }

    const data: Record<string, unknown> = { status: newStatus };
    if (notes !== undefined) {
      data.notes = notes; // null explicitly clears notes, undefined leaves unchanged
    }

    // Set confirmation/returned dates based on transition
    if (newStatus === LoanStatus.ACTIVE || newStatus === LoanStatus.ACTIVE_BY_DEFAULT) {
      data.confirmationDate = new Date();
    }
    if (newStatus === LoanStatus.RETURNED) {
      data.returnedDate = new Date();
    }

    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data,
      include: LOAN_INCLUDE,
    });

    const event: LoanStatusChangedEvent = {
      loanId,
      borrowerId: loan.borrowerId,
      lenderUserId: loan.lenderId,
      previousStatus: loan.status,
      newStatus,
    };
    this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, event);

    return toLoanResponse(updated as LoanWithRelations, userId);
  }

  async confirm(loanId: string, userId: string): Promise<LoanResponse> {
    const loan = await this.findLoanOrFail(loanId);
    this.assertBorrowerRole(loan, userId, `/v1/loans/${loanId}/confirm`);

    if (!isValidTransition(loan.status, LoanStatus.ACTIVE)) {
      throw new ConflictException(
        'invalid-status-transition',
        'Invalid Status Transition',
        `Cannot transition from ${loan.status} to ACTIVE.`,
        `/v1/loans/${loanId}/confirm`,
      );
    }

    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.ACTIVE,
        confirmationDate: new Date(),
      },
      include: LOAN_INCLUDE,
    });

    const event: LoanStatusChangedEvent = {
      loanId,
      borrowerId: loan.borrowerId,
      lenderUserId: loan.lenderId,
      previousStatus: loan.status,
      newStatus: LoanStatus.ACTIVE,
    };
    this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, event);

    return toLoanResponse(updated as LoanWithRelations, userId);
  }

  async contest(loanId: string, userId: string, dto: ContestLoanDto): Promise<LoanResponse> {
    const loan = await this.findLoanOrFail(loanId);
    this.assertBorrowerRole(loan, userId, `/v1/loans/${loanId}/contest`);

    if (!isValidTransition(loan.status, LoanStatus.CONTESTED)) {
      throw new ConflictException(
        'invalid-status-transition',
        'Invalid Status Transition',
        `Cannot transition from ${loan.status} to CONTESTED.`,
        `/v1/loans/${loanId}/contest`,
      );
    }

    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.CONTESTED,
        contestReason: dto.reason,
      },
      include: LOAN_INCLUDE,
    });

    const event: LoanStatusChangedEvent = {
      loanId,
      borrowerId: loan.borrowerId,
      lenderUserId: loan.lenderId,
      previousStatus: loan.status,
      newStatus: LoanStatus.CONTESTED,
    };
    this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, event);

    return toLoanResponse(updated as LoanWithRelations, userId);
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async resolveItem(
    tx: TxClient,
    itemInput: string | CreateItemDto,
    lenderId: string,
  ): Promise<string> {
    // UUID string → reference existing item
    if (typeof itemInput === 'string') {
      const item = await tx.item.findUnique({
        where: { id: itemInput },
      });
      // FIX-28: someone else's item is reported exactly like a missing one (no existence leak).
      if (!item || item.userId !== lenderId) {
        throw new NotFoundException('Item', itemInput, '/v1/loans');
      }
      return item.id;
    }

    // Object → create inline
    const dto = itemInput;

    if (
      dto.category === 'MONEY' &&
      (dto.estimatedValue === undefined || dto.estimatedValue === null)
    ) {
      throw new BadRequestException(
        'estimated-value-required',
        'Estimated Value Required',
        'estimatedValue is required when category is MONEY.',
        '/v1/loans',
      );
    }

    const item = await tx.item.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        estimatedValue: dto.estimatedValue ?? null,
        userId: lenderId,
      },
    });
    return item.id;
  }

  private async resolveBorrower(
    tx: TxClient,
    borrowerId: string,
    lenderId: string,
  ): Promise<string> {
    const borrower = await tx.borrower.findUnique({
      where: { id: borrowerId },
    });
    // FIX-28: someone else's contact is reported exactly like a missing one.
    if (!borrower || borrower.lenderUserId !== lenderId) {
      throw new NotFoundException('Borrower', borrowerId, '/v1/loans');
    }
    return borrower.id;
  }

  private async checkDailyRateLimit(lenderId: string): Promise<void> {
    const key = `loan-rate:${lenderId}:${this.getTodayKey()}`;
    const client = this.redis.getClient();
    const count = await client.get(key);
    if (count !== null && parseInt(count, 10) >= MAX_LOANS_PER_DAY) {
      throw new RateLimitException(
        `You have reached the maximum of ${MAX_LOANS_PER_DAY} loans per day.`,
        '/v1/loans',
        'daily-loan-limit-exceeded',
        'Daily Loan Limit Exceeded',
      );
    }
  }

  private async incrementDailyCount(lenderId: string): Promise<void> {
    const key = `loan-rate:${lenderId}:${this.getTodayKey()}`;
    const client = this.redis.getClient();
    const newCount = await client.incr(key);
    if (newCount === 1) {
      // Set TTL to expire at end of day (max 24h)
      await client.expire(key, 86400);
    }
  }

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private async findLoanOrFail(loanId: string): Promise<LoanWithRelations> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: LOAN_INCLUDE,
    });

    if (!loan || loan.deletedAt !== null) {
      throw new NotFoundException('Loan', loanId, `/v1/loans/${loanId}`);
    }

    return loan as LoanWithRelations;
  }

  /**
   * Lender-only actions. A third party gets the same 404 as for a missing loan (FIX-28);
   * the borrower is a party to the loan, so they get a 403.
   */
  private assertOwnership(loan: LoanWithRelations, userId: string, path: string): void {
    if (loan.lenderId === userId) return;
    if (loan.borrower.userId !== userId) {
      throw new NotFoundException('Loan', loan.id, `/v1/loans/${loan.id}`);
    }
    throw new ForbiddenException(
      'forbidden',
      'Forbidden',
      'You can only access or modify loans you created.',
      path,
    );
  }

  /**
   * Determines the user's role relative to a loan.
   * Throws the uniform 404 if the user is neither the lender nor the borrower (FIX-28).
   */
  private resolveUserRole(loan: LoanWithRelations, userId: string): LoanRole {
    if (loan.lenderId === userId) return 'lender';
    if (loan.borrower.userId === userId) return 'borrower';

    throw new NotFoundException('Loan', loan.id, `/v1/loans/${loan.id}`);
  }

  /**
   * Asserts the calling user is the borrower linked to this loan.
   * Used for confirm/contest (emprunteur uniquement per OpenAPI).
   */
  private assertBorrowerRole(loan: LoanWithRelations, userId: string, path: string): void {
    if (loan.borrower.userId !== userId) {
      // A third party must not learn the loan exists; the lender is a party, hence 403.
      if (loan.lenderId !== userId) {
        throw new NotFoundException('Loan', loan.id, `/v1/loans/${loan.id}`);
      }
      throw new ForbiddenException(
        'forbidden-status-transition',
        'Forbidden Status Transition',
        'Only the borrower can confirm or contest a loan.',
        path,
      );
    }
  }
}
