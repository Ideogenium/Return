import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';
import { LoanStatus, type Prisma } from '@prisma/client';
import type { LoanStatusChangedEvent } from '../common/events/loan.events.js';
import { isAllowedForRole } from './loan-status-machine.js';
import { ReminderExhaustedListener } from './reminder-exhausted.listener.js';
import { startOfUtcDay } from '../common/utils/date.util.js';
import {
  CLOSE_CANDIDATES_WHERE,
  DEFAULT_OVERDUE_BATCH_SIZE,
  DEFAULT_OVERDUE_MAX_SHARE,
  OPEN_LOANS_WHERE,
  collectLoansToClose,
  markAwaitingReturnWhere,
} from './overdue-queries.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Loans shorter than this (Δ in days) auto-confirm faster. */
const SHORT_LOAN_THRESHOLD_DAYS = 3;
const SHORT_LOAN_AUTO_CONFIRM_HOURS = 24;
const DEFAULT_AUTO_CONFIRM_HOURS = 48;

type OverdueStep = 'markAwaitingReturn' | 'closeExhausted';

interface OverdueSettings {
  batchSize: number;
  maxShare: number;
}

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
    private readonly config: ConfigService,
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
   *
   * Safety nets (NOT_RETURNED has no outgoing transition, so a wrong mass update is
   * irreversible):
   * - Kill switch: opt-in, the job only runs when OVERDUE_JOB_ENABLED is exactly 'true'.
   *   Otherwise no query is made and a "skipped" line is logged at every pass, so the
   *   job can be deployed switched off, measured, then enabled.
   * - Batch: each step processes at most OVERDUE_JOB_BATCH_SIZE loans per pass (default
   *   100, deterministic order); the rest is picked up at the following passes. A large
   *   legitimate backlog is therefore drained progressively instead of being blocked.
   * - Circuit breaker: at the head of each step, the step's candidates are counted
   *   against the open loans (ACTIVE, ACTIVE_BY_DEFAULT, AWAITING_RETURN, not deleted).
   *   If candidates > OVERDUE_JOB_MAX_SHARE (]0, 1], default 0.5) x open loans AND
   *   candidates > batch size, the step writes nothing and logs an error: when most of the
   *   open loans suddenly look overdue, a bug (clock, data) is likelier than reality. The
   *   batch-size guard keeps tiny databases (1 open loan out of 1) from tripping it. The
   *   tick line then ends with "— tripped: <step>". Raise the share once checked.
   * - Step isolation: each step has its own try/catch. A failing step is logged
   *   (error + stack) and reported in the tick line, and does not prevent the other one
   *   from running.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueLoans(): Promise<void> {
    if (this.config.get<string>('OVERDUE_JOB_ENABLED') !== 'true') {
      this.logger.log("Overdue tick: skipped (OVERDUE_JOB_ENABLED is not 'true')");
      return;
    }

    const settings = this.overdueSettings();
    const counters = { marked: 0, closed: 0 };
    const failedSteps: OverdueStep[] = [];
    const trippedSteps: OverdueStep[] = [];

    const runStep = async (step: OverdueStep, run: () => Promise<boolean>): Promise<void> => {
      try {
        if (!(await run())) trippedSteps.push(step);
      } catch (error) {
        failedSteps.push(step);
        this.logger.error(
          `Overdue step ${step} failed: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    };

    await runStep('markAwaitingReturn', () =>
      this.markOverdueLoansAwaitingReturn(counters, settings),
    );
    await runStep('closeExhausted', () => this.closeExhaustedLoans(counters, settings));

    const suffix =
      (failedSteps.length > 0 ? ` — failed: ${failedSteps.join(', ')}` : '') +
      (trippedSteps.length > 0 ? ` — tripped: ${trippedSteps.join(', ')}` : '');
    this.logger.log(
      `Overdue tick: ${counters.marked} loan(s) marked AWAITING_RETURN, ${counters.closed} closed NOT_RETURNED (catch-up)${suffix}`,
    );
  }

  /** Both settings fall back to their default when unset or invalid, never blocking startup. */
  private overdueSettings(): OverdueSettings {
    const rawBatch = Number(this.config.get<string | number>('OVERDUE_JOB_BATCH_SIZE'));
    const rawShare = Number(this.config.get<string | number>('OVERDUE_JOB_MAX_SHARE'));
    return {
      batchSize: Number.isInteger(rawBatch) && rawBatch > 0 ? rawBatch : DEFAULT_OVERDUE_BATCH_SIZE,
      maxShare: rawShare > 0 && rawShare <= 1 ? rawShare : DEFAULT_OVERDUE_MAX_SHARE,
    };
  }

  /**
   * @returns true when the step may write. When tripped, logs the error and returns false.
   * Why counts and not a sample: the decision is about the whole backlog, not one batch.
   */
  private async passesCircuitBreaker(
    step: OverdueStep,
    candidatesWhere: Prisma.LoanWhereInput,
    { batchSize, maxShare }: OverdueSettings,
  ): Promise<boolean> {
    const [candidates, open] = await Promise.all([
      this.prisma.loan.count({ where: candidatesWhere }),
      this.prisma.loan.count({ where: OPEN_LOANS_WHERE }),
    ]);
    if (candidates <= batchSize || candidates <= maxShare * open) return true;

    this.logger.error(
      `Overdue step ${step} tripped the circuit breaker: ${candidates} candidate(s) out of ${open} open loan(s) ` +
        `(${((candidates / open) * 100).toFixed(1)}%, limit ${(maxShare * 100).toFixed(1)}%), nothing was written. ` +
        'Check the data, then raise OVERDUE_JOB_MAX_SHARE if this volume is legitimate.',
    );
    return false;
  }

  /** @returns false when the circuit breaker tripped (nothing written). */
  private async markOverdueLoansAwaitingReturn(
    counters: { marked: number },
    settings: OverdueSettings,
  ): Promise<boolean> {
    const now = new Date();
    // Same "today" as the lender statistics (FEAT-04): see startOfUtcDay.
    const startOfTodayUtc = startOfUtcDay(now);
    const where = markAwaitingReturnWhere(startOfTodayUtc);

    if (!(await this.passesCircuitBreaker('markAwaitingReturn', where, settings))) return false;

    // Marked loans leave the `where` (status changes), so the next pass naturally
    // resumes with the following ones instead of re-reading the same batch.
    const overdueLoans = await this.prisma.loan.findMany({
      where,
      select: { id: true, status: true, borrowerId: true, lenderId: true },
      orderBy: [{ returnDate: 'asc' }, { id: 'asc' }],
      take: settings.batchSize,
    });

    for (const loan of overdueLoans) {
      if (!isAllowedForRole(loan.status, LoanStatus.AWAITING_RETURN, 'system')) continue;

      try {
        const { count } = await this.prisma.loan.updateMany({
          // Re-check the due date and deletion: a PATCH (FEAT-11) postponing the date, or a
          // delete, between the findMany and this update must not be overridden.
          where: {
            id: loan.id,
            status: loan.status,
            deletedAt: null,
            returnDate: { lt: startOfTodayUtc },
          },
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
    return true;
  }

  /** @returns false when the circuit breaker tripped (nothing written). */
  private async closeExhaustedLoans(
    counters: { closed: number },
    settings: OverdueSettings,
  ): Promise<boolean> {
    // The count includes stale candidates (FINAL_OVERDUE of an older due date): it can
    // only overestimate, which errs on the safe side for a breaker.
    if (!(await this.passesCircuitBreaker('closeExhausted', CLOSE_CANDIDATES_WHERE, settings))) {
      return false;
    }

    const exhaustedLoans = await collectLoansToClose(
      this.prisma,
      settings.batchSize,
      settings.batchSize,
    );

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
    return true;
  }
}
