import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, type ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { NotFoundException } from '../common/exceptions/problem-details.exception.js';

const REMINDER_TITLES: Record<string, string> = {
  PREVENTIVE: 'Rappel préventif',
  ON_DUE_DATE: 'Rappel jour J',
  FIRST_OVERDUE: 'Premier rappel de retard',
  SECOND_OVERDUE: 'Deuxième rappel de retard',
  FINAL_OVERDUE: 'Dernier rappel avant clôture',
};

export interface PaginatedNotifications {
  data: Array<{
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    isRead: boolean;
    relatedLoanId: string | null;
    createdAt: Date;
  }>;
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface FindAllOptions {
  page: number;
  limit: number;
  unreadOnly: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async sendReminderNotification(
    reminderId: string,
    loanId: string,
    lenderUserId: string,
    reminderType: ReminderType,
    borrowerUserId: string | null = null,
  ): Promise<void> {
    const title = REMINDER_TITLES[reminderType] ?? 'Rappel de prêt';

    await this.prisma.notification.create({
      data: {
        userId: lenderUserId,
        type: NotificationType.REMINDER_SENT,
        title,
        body: `Un rappel de type ${reminderType} a été envoyé pour votre prêt.`,
        relatedLoanId: loanId,
      },
    });

    if (borrowerUserId) {
      await this.prisma.notification.create({
        data: {
          userId: borrowerUserId,
          type: NotificationType.REMINDER_RECEIVED,
          title,
          body: `Vous avez un rappel concernant un objet emprunté.`,
          relatedLoanId: loanId,
        },
      });
    }

    this.logger.log(`Sent ${reminderType} notification for reminder ${reminderId}, loan ${loanId}`);

    // Send FCM push notifications — per-recipient body
    const lenderBody = `Un rappel de type ${reminderType} a été envoyé pour votre prêt.`;
    await this.sendPushToUsers([lenderUserId], title, lenderBody, {
      loanId,
      reminderId,
      type: 'REMINDER',
    });

    if (borrowerUserId) {
      const borrowerBody = `Vous avez un rappel concernant un objet emprunté.`;
      await this.sendPushToUsers([borrowerUserId], title, borrowerBody, {
        loanId,
        reminderId,
        type: 'REMINDER',
      });
    }
  }

  async findAllByUser(userId: string, options: FindAllOptions): Promise<PaginatedNotifications> {
    const { page, limit, unreadOnly } = options;
    const skip = (page - 1) * limit;

    const where: { userId: string; isRead?: boolean } = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        relatedLoanId: n.relatedLoanId,
        createdAt: n.createdAt,
      })),
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    // FIX-28: someone else's notification is reported exactly like a missing one.
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(
        'Notification',
        notificationId,
        `/v1/notifications/${notificationId}/read`,
      );
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseService.isAvailable()) return;

    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
        user: { pushNotificationsEnabled: true },
      },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    try {
      const invalidTokens = await this.firebaseService.sendToMultipleTokens(
        tokens.map((t) => t.token),
        title,
        body,
        data,
      );

      if (invalidTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({
          where: {
            token: { in: invalidTokens },
            userId: { in: userIds },
          },
        });
        this.logger.log(`Cleaned up ${invalidTokens.length} invalid device token(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push or clean up tokens: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
