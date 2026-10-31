import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { NotificationType, ReminderType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { NotificationsService } from './notifications.service.js';

// =============================================================================
// Fixtures
// =============================================================================

const REMINDER_ID = 'rem-11111111-1111-1111-1111-111111111111';
const LOAN_ID = '11111111-1111-1111-1111-111111111111';
const LENDER_USER_ID = '33333333-3333-3333-3333-333333333333';
const BORROWER_USER_ID = '44444444-4444-4444-4444-444444444444';
const NOTIFICATION_ID = 'notif-1111-1111-1111-111111111111';

const EXPO_TOKEN_VALID = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const EXPO_TOKEN_INVALID = 'ExponentPushToken[zzzzzzzzzzzzzzzzzzzz]';

// =============================================================================
// Test Suite — REM-011
// =============================================================================

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let firebaseService: { isAvailable: jest.Mock; sendToMultipleTokens: jest.Mock };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    firebaseService = {
      isAvailable: jest.fn().mockReturnValue(false),
      // Returns string[] (list of invalid tokens) — default: no invalid tokens
      sendToMultipleTokens: jest.fn().mockResolvedValue([]),
    };
    service = new NotificationsService(prisma, firebaseService as unknown as FirebaseService);
  });

  describe('sendReminderNotification', () => {
    it('should create a REMINDER_SENT notification for the lender', async () => {
      prisma.notification.create.mockResolvedValue({
        id: NOTIFICATION_ID,
        userId: LENDER_USER_ID,
        type: NotificationType.REMINDER_SENT,
        title: 'Rappel de prêt',
        body: expect.any(String),
        isRead: false,
        relatedLoanId: LOAN_ID,
        createdAt: expect.any(Date),
      } as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: LENDER_USER_ID,
          type: NotificationType.REMINDER_SENT,
          title: expect.any(String),
          body: expect.any(String),
          relatedLoanId: LOAN_ID,
        },
      });
    });

    it('should also create a REMINDER_RECEIVED notification for the borrower when borrowerUserId is provided', async () => {
      prisma.notification.create.mockResolvedValue({} as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
        BORROWER_USER_ID,
      );

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: BORROWER_USER_ID,
          type: NotificationType.REMINDER_RECEIVED,
          title: expect.any(String),
          body: expect.any(String),
          relatedLoanId: LOAN_ID,
        },
      });
    });

    it('should NOT create a borrower notification when borrowerUserId is null', async () => {
      prisma.notification.create.mockResolvedValue({} as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
        null,
      );

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: NotificationType.REMINDER_SENT }),
      });
    });

    it('should send FCM push to lender when Firebase is available and tokens exist', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.notification.create.mockResolvedValue({} as never);
      prisma.deviceToken.findMany.mockResolvedValue([{ token: EXPO_TOKEN_VALID }] as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
      );

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [LENDER_USER_ID] },
          user: { pushNotificationsEnabled: true },
        },
        select: { token: true },
      });
      expect(firebaseService.sendToMultipleTokens).toHaveBeenCalledWith(
        [EXPO_TOKEN_VALID],
        expect.any(String),
        expect.stringContaining('prêt'),
        expect.objectContaining({ loanId: LOAN_ID }),
      );
    });

    it('should send separate FCM pushes to lender and borrower with different bodies', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.notification.create.mockResolvedValue({} as never);
      prisma.deviceToken.findMany
        .mockResolvedValueOnce([{ token: 'lender-token' }] as never)
        .mockResolvedValueOnce([{ token: 'borrower-token' }] as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
        BORROWER_USER_ID,
      );

      expect(firebaseService.sendToMultipleTokens).toHaveBeenCalledTimes(2);
      expect(firebaseService.sendToMultipleTokens).toHaveBeenCalledWith(
        ['lender-token'],
        expect.any(String),
        expect.stringContaining('prêt'),
        expect.objectContaining({ type: 'REMINDER' }),
      );
      expect(firebaseService.sendToMultipleTokens).toHaveBeenCalledWith(
        ['borrower-token'],
        expect.any(String),
        expect.stringContaining('emprunté'),
        expect.objectContaining({ type: 'REMINDER' }),
      );
    });

    it('should NOT send FCM push when no device tokens found', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.notification.create.mockResolvedValue({} as never);
      prisma.deviceToken.findMany.mockResolvedValue([] as never);

      await service.sendReminderNotification(
        REMINDER_ID,
        LOAN_ID,
        LENDER_USER_ID,
        ReminderType.ON_DUE_DATE,
      );

      expect(firebaseService.sendToMultipleTokens).not.toHaveBeenCalled();
    });
  });

  describe('sendPushToUsers', () => {
    it('should delete invalid tokens returned by sendToMultipleTokens', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.deviceToken.findMany.mockResolvedValue([
        { token: EXPO_TOKEN_VALID },
        { token: EXPO_TOKEN_INVALID },
      ] as never);
      firebaseService.sendToMultipleTokens.mockResolvedValue([EXPO_TOKEN_INVALID]);
      prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.sendPushToUsers([LENDER_USER_ID], 'Test', 'Body');

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: {
          token: { in: [EXPO_TOKEN_INVALID] },
          userId: { in: [LENDER_USER_ID] },
        },
      });
    });

    it('should NOT call deleteMany when sendToMultipleTokens returns empty array', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.deviceToken.findMany.mockResolvedValue([{ token: EXPO_TOKEN_VALID }] as never);
      firebaseService.sendToMultipleTokens.mockResolvedValue([]);

      await service.sendPushToUsers([LENDER_USER_ID], 'Test', 'Body');

      expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete multiple invalid tokens when sendToMultipleTokens returns several', async () => {
      const staleToken1 = 'stale-token-aaa';
      const staleToken2 = 'stale-token-bbb';
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.deviceToken.findMany.mockResolvedValue([
        { token: EXPO_TOKEN_VALID },
        { token: staleToken1 },
        { token: staleToken2 },
      ] as never);
      firebaseService.sendToMultipleTokens.mockResolvedValue([staleToken1, staleToken2]);
      prisma.deviceToken.deleteMany.mockResolvedValue({ count: 2 });

      await service.sendPushToUsers([LENDER_USER_ID], 'Test', 'Body');

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: {
          token: { in: [staleToken1, staleToken2] },
          userId: { in: [LENDER_USER_ID] },
        },
      });
    });

    it('should return early without calling Firebase when Firebase is unavailable', async () => {
      firebaseService.isAvailable.mockReturnValue(false);

      await service.sendPushToUsers([LENDER_USER_ID], 'Test', 'Body');

      expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
      expect(firebaseService.sendToMultipleTokens).not.toHaveBeenCalled();
    });

    it('should return early without calling sendToMultipleTokens when no device tokens found', async () => {
      firebaseService.isAvailable.mockReturnValue(true);
      prisma.deviceToken.findMany.mockResolvedValue([] as never);

      await service.sendPushToUsers([LENDER_USER_ID], 'Test', 'Body');

      expect(firebaseService.sendToMultipleTokens).not.toHaveBeenCalled();
    });
  });

  describe('findAllByUser', () => {
    it('should return paginated notifications for the user', async () => {
      const mockNotifications = [
        {
          id: NOTIFICATION_ID,
          userId: BORROWER_USER_ID,
          type: NotificationType.LOAN_CREATED,
          title: 'Nouveau prêt',
          body: 'Un prêt a été créé.',
          isRead: false,
          relatedLoanId: LOAN_ID,
          createdAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications as never);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.findAllByUser(BORROWER_USER_ID, {
        page: 1,
        limit: 20,
        unreadOnly: false,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: BORROWER_USER_ID },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter unread only when unreadOnly is true', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAllByUser(BORROWER_USER_ID, {
        page: 1,
        limit: 20,
        unreadOnly: true,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: BORROWER_USER_ID, isRead: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('markAsRead', () => {
    it('should update notification isRead to true', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: NOTIFICATION_ID,
        userId: BORROWER_USER_ID,
        isRead: false,
      } as never);
      prisma.notification.update.mockResolvedValue({} as never);

      await service.markAsRead(NOTIFICATION_ID, BORROWER_USER_ID);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead(NOTIFICATION_ID, BORROWER_USER_ID)).rejects.toThrow(
        'Not Found',
      );
    });

    it('should throw ForbiddenException when notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: NOTIFICATION_ID,
        userId: 'other-user-id',
        isRead: false,
      } as never);

      await expect(service.markAsRead(NOTIFICATION_ID, BORROWER_USER_ID)).rejects.toThrow(
        'Forbidden',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for the user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      await service.markAllAsRead(BORROWER_USER_ID);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: BORROWER_USER_ID, isRead: false },
        data: { isRead: true },
      });
    });
  });
});
