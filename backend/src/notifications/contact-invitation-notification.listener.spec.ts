import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { ContactInvitationNotificationListener } from './contact-invitation-notification.listener.js';
import { CONTACT_INVITATION_EVENTS } from '../common/events/contact-invitation.events.js';
import type {
  ContactInvitationAcceptedEvent,
  ContactInvitationSentEvent,
} from '../common/events/contact-invitation.events.js';

const INVITATION_ID = '11111111-1111-1111-1111-111111111111';
const SENDER_USER_ID = '22222222-2222-2222-2222-222222222222';
const RECIPIENT_USER_ID = '33333333-3333-3333-3333-333333333333';

const sentEvent: ContactInvitationSentEvent = {
  invitationId: INVITATION_ID,
  senderUserId: SENDER_USER_ID,
  recipientUserId: RECIPIENT_USER_ID,
  senderFirstName: 'Jean',
  senderLastName: 'Martin',
};

const acceptedEvent: ContactInvitationAcceptedEvent = {
  invitationId: INVITATION_ID,
  senderUserId: SENDER_USER_ID,
  recipientUserId: RECIPIENT_USER_ID,
  recipientEmail: 'marie.dupont@example.com',
  borrowerId: '44444444-4444-4444-4444-444444444444',
};

describe('ContactInvitationNotificationListener', () => {
  let listener: ContactInvitationNotificationListener;
  let prisma: DeepMockProxy<PrismaService>;
  let notificationsService: { sendPushToUsers: jest.Mock };
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    notificationsService = { sendPushToUsers: jest.fn().mockResolvedValue(undefined) };
    listener = new ContactInvitationNotificationListener(
      prisma,
      notificationsService as unknown as NotificationsService,
    );
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe(`@OnEvent(${CONTACT_INVITATION_EVENTS.SENT})`, () => {
    it('should create a CONTACT_INVITATION_RECEIVED notification for the recipient', async () => {
      await listener.handleInvitationSent(sentEvent);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: RECIPIENT_USER_ID,
          type: NotificationType.CONTACT_INVITATION_RECEIVED,
          title: 'Nouvelle invitation',
          body: "Jean Martin vous invite à l'ajouter à ses contacts.",
          relatedLoanId: null,
          actorUserId: SENDER_USER_ID,
        },
      });
    });

    it('should push to the recipient with { type, invitationId }', async () => {
      await listener.handleInvitationSent(sentEvent);

      expect(notificationsService.sendPushToUsers).toHaveBeenCalledWith(
        [RECIPIENT_USER_ID],
        'Nouvelle invitation',
        "Jean Martin vous invite à l'ajouter à ses contacts.",
        { type: 'CONTACT_INVITATION_RECEIVED', invitationId: INVITATION_ID },
      );
    });

    it('should not throw and log an error when the notification cannot be created', async () => {
      prisma.notification.create.mockRejectedValue(new Error('db down'));

      await expect(listener.handleInvitationSent(sentEvent)).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      expect(notificationsService.sendPushToUsers).not.toHaveBeenCalled();
    });

    it('should not throw when the push fails (in-app notification is kept)', async () => {
      notificationsService.sendPushToUsers.mockRejectedValue(new Error('fcm down'));

      await expect(listener.handleInvitationSent(sentEvent)).resolves.toBeUndefined();

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  describe(`@OnEvent(${CONTACT_INVITATION_EVENTS.ACCEPTED})`, () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Marie', lastName: 'Dupont' } as never);
    });

    it('should create a CONTACT_INVITATION_ACCEPTED notification for the sender', async () => {
      await listener.handleInvitationAccepted(acceptedEvent);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: RECIPIENT_USER_ID },
        select: { firstName: true, lastName: true },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: SENDER_USER_ID,
          type: NotificationType.CONTACT_INVITATION_ACCEPTED,
          title: 'Invitation acceptée',
          body: 'Marie Dupont a accepté votre invitation.',
          relatedLoanId: null,
          actorUserId: RECIPIENT_USER_ID,
        },
      });
    });

    it('should push to the sender with { type, invitationId }', async () => {
      await listener.handleInvitationAccepted(acceptedEvent);

      expect(notificationsService.sendPushToUsers).toHaveBeenCalledWith(
        [SENDER_USER_ID],
        'Invitation acceptée',
        'Marie Dupont a accepté votre invitation.',
        { type: 'CONTACT_INVITATION_ACCEPTED', invitationId: INVITATION_ID },
      );
    });

    it('should skip silently when the accepting user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(listener.handleInvitationAccepted(acceptedEvent)).resolves.toBeUndefined();

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should not throw and log an error when Prisma fails', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('db down'));

      await expect(listener.handleInvitationAccepted(acceptedEvent)).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should not throw when the push fails (in-app notification is kept)', async () => {
      notificationsService.sendPushToUsers.mockRejectedValue(new Error('fcm down'));

      await expect(listener.handleInvitationAccepted(acceptedEvent)).resolves.toBeUndefined();

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('REJECTED', () => {
    it('should not listen to the REJECTED event', () => {
      const proto = ContactInvitationNotificationListener.prototype as unknown as Record<
        string,
        unknown
      >;
      expect(proto['handleInvitationRejected']).toBeUndefined();
    });
  });
});
