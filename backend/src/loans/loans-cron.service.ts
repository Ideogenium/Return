import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import { LoanStatus } from '@prisma/client';
import type { LoanStatusChangedEvent } from '../common/events/loan.events.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Loans shorter than this (Δ in days) auto-confirm faster. */
const SHORT_LOAN_THRESHOLD_DAYS = 3;
const SHORT_LOAN_AUTO_CONFIRM_HOURS = 24;
const DEFAULT_AUTO_CONFIRM_HOURS = 48;

/**
 * CRON job: auto-confirm pending loans after their timeout.
 *
 * Runs every hour to find loans in PENDING_CONFIRMATION status that have
 * exceeded their auto-confirmation delay and transitions them to
 * ACTIVE_BY_DEFAULT.
 *
 * FIX-05 vol. A: the delay depends on the loan duration (Δ = returnDate −
 * createdAt). Short loans (Δ < 3 days) auto-confirm after 24h so that a 2-day
 * loan is not auto-confirmed exactly at its due date; longer loans (or loans
 * without a return date) keep the 48h delay.
 *
 * Ref: LOAN-022 / LOAN-023
 */
@Injectable()
export class LoansCronService {
  private readonly logger = new Logger(LoansCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Auto-confirmation delay (in hours) for a given loan, based on its duration. */
  private autoConfirmThresholdHours(returnDate: Date | null, createdAt: Date): number {
    if (!returnDate) return DEFAULT_AUTO_CONFIRM_HOURS;
    const deltaDays = Math.floor((returnDate.getTime() - createdAt.getTime()) / DAY_MS);
    return deltaDays < SHORT_LOAN_THRESHOLD_DAYS
      ? SHORT_LOAN_AUTO_CONFIRM_HOURS
      : DEFAULT_AUTO_CONFIRM_HOURS;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePendingTimeout(): Promise<void> {
    const now = Date.now();
    // Fetch every loan past the shortest possible threshold (24h); the exact
    // per-loan threshold is then applied in memory below.
    const shortestCutoff = new Date(now - SHORT_LOAN_AUTO_CONFIRM_HOURS * HOUR_MS);

    const candidates = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.PENDING_CONFIRMATION,
        createdAt: { lt: shortestCutoff },
        deletedAt: null,
      },
      select: { id: true, borrowerId: true, lenderId: true, createdAt: true, returnDate: true },
    });

    const expiredLoans = candidates.filter((loan) => {
      const thresholdMs = this.autoConfirmThresholdHours(loan.returnDate, loan.createdAt) * HOUR_MS;
      return now - loan.createdAt.getTime() >= thresholdMs;
    });

    // One line per run, even when idle: a silent job is indistinguishable from a dead one.
    this.logger.log(`Pending-confirmation tick: ${expiredLoans.length} loan(s) to auto-confirm`);
    if (expiredLoans.length === 0) return;

    // Batch update all expired loans
    await this.prisma.loan.updateMany({
      where: {
        id: { in: expiredLoans.map((l) => l.id) },
      },
      data: {
        status: LoanStatus.ACTIVE_BY_DEFAULT,
        confirmationDate: new Date(),
      },
    });

    // Emit events for each transitioned loan
    for (const loan of expiredLoans) {
      const event: LoanStatusChangedEvent = {
        loanId: loan.id,
        borrowerId: loan.borrowerId,
        lenderUserId: loan.lenderId,
        previousStatus: LoanStatus.PENDING_CONFIRMATION,
        newStatus: LoanStatus.ACTIVE_BY_DEFAULT,
      };
      this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, event);
    }
  }
}
