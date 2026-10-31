import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';
import type { LoanStatusChangedEvent } from '../common/events/loan.events.js';
import { isAllowedForRole } from './loan-status-machine.js';
import { ReminderExhaustedListener } from './reminder-exhausted.listener.js';
import { ReminderPolicy } from '../reminders/reminder-policy.js';
import { startOfUtcDay } from '../common/utils/date.util.js';

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
    private readonly reminderExhaustedListener: ReminderExhaustedListener,
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

  /**
   * FEAT-10: ACTIVE / ACTIVE_BY_DEFAULT → AWAITING_RETURN once the due day is over.
   *
   * "Overdue" = returnDate strictly before today's UTC calendar day (returnDate is
   * @db.Date, i.e. midnight UTC): the due day itself is still on time, consistent
   * with the on-time/late rule of BorrowerStatsListener (calendar day, UTC).
   *
   * Idempotent: each loan is updated with its current status in the `where`, and
   * the event is only emitted when that update really matched a row.
   *
   * Catch-up: loans already AWAITING_RETURN whose FINAL_OVERDUE reminder is SENT or
   * FAILED *for the current due date* are closed now, through the same logic as the
   * ALL_EXHAUSTED listener. Why: a FAILED FINAL_OVERDUE does not emit ALL_EXHAUSTED, so
   * this catch-up is the only thing that closes such a loan (at the next tick) instead
   * of leaving it AWAITING_RETURN forever; and a FINAL_OVERDUE sent for an older
   * returnDate (postponed since) must not close the loan prematurely.
   *
   * Reminders are deliberately left untouched here (cancellation is FEAT-11).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueLoans(): Promise<void> {
    const counters = { marked: 0, closed: 0 };
    try {
      await this.markOverdueLoansAwaitingReturn(counters);
      await this.closeExhaustedLoans(counters);
    } finally {
      // Emitted on every pass, even if a query failed
      this.logger.log(
        `Overdue tick: ${counters.marked} loan(s) marked AWAITING_RETURN, ${counters.closed} closed NOT_RETURNED (catch-up)`,
      );
    }
  }

  private async markOverdueLoansAwaitingReturn(counters: { marked: number }): Promise<void> {
    const now = new Date();
    // Same "today" as the lender statistics (FEAT-04): see startOfUtcDay.
    const startOfTodayUtc = startOfUtcDay(now);

    const overdueLoans = await this.prisma.loan.findMany({
      where: {
        status: { in: [LoanStatus.ACTIVE, LoanStatus.ACTIVE_BY_DEFAULT] },
        deletedAt: null,
        returnDate: { not: null, lt: startOfTodayUtc },
      },
      select: { id: true, status: true, borrowerId: true, lenderId: true },
    });

    for (const loan of overdueLoans) {
      if (!isAllowedForRole(loan.status, LoanStatus.AWAITING_RETURN, 'system')) continue;

      try {
        const { count } = await this.prisma.loan.updateMany({
          where: { id: loan.id, status: loan.status },
          data: { status: LoanStatus.AWAITING_RETURN },
        });
        if (count === 0) continue; // already moved (concurrent tick / lender action)

        counters.marked++;
        const event: LoanStatusChangedEvent = {
          loanId: loan.id,
          borrowerId: loan.borrowerId,
          lenderUserId: loan.lenderId,
          previousStatus: loan.status,
          newStatus: LoanStatus.AWAITING_RETURN,
        };
        this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, event);
      } catch (error) {
        this.logger.error(`Failed to mark loan ${loan.id} AWAITING_RETURN: ${String(error)}`);
      }
    }
  }

  private async closeExhaustedLoans(counters: { closed: number }): Promise<void> {
    const finalOverdueFilter = {
      type: ReminderType.FINAL_OVERDUE,
      status: { in: [ReminderStatus.SENT, ReminderStatus.FAILED] },
    };

    const candidates = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.AWAITING_RETURN,
        deletedAt: null,
        reminders: { some: finalOverdueFilter },
      },
      select: {
        id: true,
        borrowerId: true,
        lenderId: true,
        createdAt: true,
        returnDate: true,
        reminders: { where: finalOverdueFilter, select: { status: true, scheduledFor: true } },
      },
    });

    // Only keep loans whose FINAL_OVERDUE matches the current returnDate: its
    // scheduledFor must not be earlier than the one the policy computes today.
    const exhaustedLoans = candidates.filter((loan) => {
      const expected = ReminderPolicy.calculateDates(loan.returnDate, loan.createdAt).find(
        (schedule) => schedule.type === ReminderType.FINAL_OVERDUE,
      );
      if (!expected) return false;
      return loan.reminders.some(
        (reminder) =>
          reminder.status !== ReminderStatus.SCHEDULED &&
          reminder.scheduledFor.getTime() >= expected.scheduledFor.getTime(),
      );
    });

    for (const loan of exhaustedLoans) {
      try {
        const wasClosed = await this.reminderExhaustedListener.closeAsNotReturned({
          loanId: loan.id,
          borrowerId: loan.borrowerId,
          lenderUserId: loan.lenderId,
        });
        if (wasClosed) counters.closed++;
      } catch (error) {
        this.logger.error(`Failed to close overdue loan ${loan.id}: ${String(error)}`);
      }
    }
  }
}
