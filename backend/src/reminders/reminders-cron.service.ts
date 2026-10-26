import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReminderStatus, ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { REMINDABLE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';
import { REMINDER_EVENTS } from '../common/events/reminder.events.js';
import type { AllRemindersExhaustedEvent } from '../common/events/reminder.events.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class RemindersCronService {
  private readonly logger = new Logger(RemindersCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendScheduledReminders(): Promise<void> {
    const now = new Date();

    const reminders = await this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.SCHEDULED,
        scheduledFor: { lte: now },
        // Defense in depth: event-driven cancellation can be missed (in-process events).
        loan: { deletedAt: null, status: { in: REMINDABLE_LOAN_STATUSES } },
      },
      include: {
        loan: {
          select: {
            id: true,
            borrowerId: true,
            lenderId: true,
            borrower: { select: { userId: true } },
          },
        },
      },
    });

    if (reminders.length === 0) return;

    this.logger.log(`Processing ${reminders.length} scheduled reminder(s)`);

    for (const reminder of reminders) {
      try {
        await this.notificationsService.sendReminderNotification(
          reminder.id,
          reminder.loan.id,
          reminder.loan.lenderId,
          reminder.type,
          reminder.loan.borrower?.userId ?? null,
        );

        // Conditional on SCHEDULED: never overwrite a cancellation made meanwhile.
        await this.prisma.reminder.updateMany({
          where: { id: reminder.id, status: ReminderStatus.SCHEDULED },
          data: { status: ReminderStatus.SENT, sentAt: new Date() },
        });

        if (reminder.type === ReminderType.FINAL_OVERDUE) {
          const event: AllRemindersExhaustedEvent = {
            loanId: reminder.loan.id,
            borrowerId: reminder.loan.borrowerId,
            lenderUserId: reminder.loan.lenderId,
          };
          this.eventEmitter.emit(REMINDER_EVENTS.ALL_EXHAUSTED, event);
          this.logger.log(`All reminders exhausted for loan ${reminder.loan.id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send reminder ${reminder.id}: ${String(error)}`);
        await this.prisma.reminder.updateMany({
          where: { id: reminder.id, status: ReminderStatus.SCHEDULED },
          data: { status: ReminderStatus.FAILED },
        });
      }
    }
  }
}
