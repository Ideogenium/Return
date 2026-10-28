import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { LoanStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { REMINDER_EVENTS } from '../common/events/reminder.events.js';
import type { AllRemindersExhaustedEvent } from '../common/events/reminder.events.js';
import { LOAN_EVENTS } from '../common/events/loan.events.js';

@Injectable()
export class ReminderExhaustedListener {
  private readonly logger = new Logger(ReminderExhaustedListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(REMINDER_EVENTS.ALL_EXHAUSTED)
  async handleAllExhausted(event: AllRemindersExhaustedEvent): Promise<void> {
    this.logger.log(`All reminders exhausted for loan ${event.loanId}`);
    await this.closeAsNotReturned(event);
  }

  /**
   * AWAITING_RETURN → NOT_RETURNED, with the STATUS_CHANGED event that drives the
   * borrower stats / trustScore recalculation. Shared by the ALL_EXHAUSTED handler
   * and the overdue catch-up CRON. Returns true only if the loan was really closed.
   */
  async closeAsNotReturned(event: AllRemindersExhaustedEvent): Promise<boolean> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: event.loanId },
      select: { id: true, status: true },
    });

    if (!loan || loan.status !== LoanStatus.AWAITING_RETURN) {
      this.logger.warn(
        `Loan ${event.loanId} is not in AWAITING_RETURN status (current: ${loan?.status}), skipping NOT_RETURNED transition`,
      );
      return false;
    }

    await this.prisma.loan.update({
      where: { id: event.loanId },
      data: { status: LoanStatus.NOT_RETURNED },
    });

    this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, {
      loanId: event.loanId,
      borrowerId: event.borrowerId,
      lenderUserId: event.lenderUserId,
      previousStatus: LoanStatus.AWAITING_RETURN,
      newStatus: LoanStatus.NOT_RETURNED,
    });

    this.logger.log(`Loan ${event.loanId} transitioned to NOT_RETURNED`);
    return true;
  }
}
