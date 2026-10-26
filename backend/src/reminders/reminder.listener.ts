import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoanStatus } from '@prisma/client';

import { LOAN_EVENTS } from '../common/events/loan.events.js';
import type {
  LoanCreatedEvent,
  LoanDeletedEvent,
  LoanReturnDateChangedEvent,
  LoanStatusChangedEvent,
} from '../common/events/loan.events.js';
import { RemindersService } from './reminders.service.js';

/**
 * Closing statuses: no reminder may be sent afterwards. AWAITING_RETURN is
 * deliberately absent — the overdue reminders are what lead to NOT_RETURNED.
 */
const CLOSING_STATUSES: ReadonlySet<string> = new Set([
  LoanStatus.RETURNED,
  LoanStatus.ABANDONED,
  LoanStatus.CONTESTED,
  LoanStatus.NOT_RETURNED,
]);

@Injectable()
export class ReminderListener {
  private readonly logger = new Logger(ReminderListener.name);

  constructor(private readonly remindersService: RemindersService) {}

  @OnEvent(LOAN_EVENTS.CREATED)
  async handleLoanCreated(event: LoanCreatedEvent): Promise<void> {
    this.logger.debug(`Scheduling reminders for loan ${event.loanId}`);

    await this.remindersService.scheduleReminders(event.loanId, event.returnDate, event.createdAt);
  }

  @OnEvent(LOAN_EVENTS.STATUS_CHANGED)
  async handleLoanStatusChanged(event: LoanStatusChangedEvent): Promise<void> {
    if (!CLOSING_STATUSES.has(event.newStatus)) return;

    await this.remindersService.cancelScheduled(event.loanId);
  }

  @OnEvent(LOAN_EVENTS.DELETED)
  async handleLoanDeleted(event: LoanDeletedEvent): Promise<void> {
    await this.remindersService.cancelScheduled(event.loanId);
  }

  @OnEvent(LOAN_EVENTS.RETURN_DATE_CHANGED)
  async handleReturnDateChanged(event: LoanReturnDateChangedEvent): Promise<void> {
    await this.remindersService.reschedule(event.loanId, event.changedAt);
  }
}
