import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { CONTACT_INVITATION_EVENTS } from '../common/events/contact-invitation.events.js';
import type {
  ContactInvitationAcceptedEvent,
  ContactInvitationSentEvent,
} from '../common/events/contact-invitation.events.js';

/**
 * Notifie la réception (au destinataire) et l'acceptation (à l'émetteur) d'une
 * invitation de contact. Le refus, l'expiration et l'annulation ne notifient pas.
 * Un échec ici ne doit jamais remonter à l'envoi ou à l'acceptation de l'invitation.
 */
@Injectable()
export class ContactInvitationNotificationListener {
  private readonly logger = new Logger(ContactInvitationNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(CONTACT_INVITATION_EVENTS.SENT)
  async handleInvitationSent(event: ContactInvitationSentEvent): Promise<void> {
    try {
      await this.notify(
        event.recipientUserId,
        event.invitationId,
        NotificationType.CONTACT_INVITATION_RECEIVED,
        {
          title: 'Nouvelle invitation',
          body: `${event.senderFirstName} ${event.senderLastName} vous invite à l'ajouter à ses contacts.`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send CONTACT_INVITATION_RECEIVED notification for invitation ${event.invitationId}: ${String(error)}`,
      );
    }
  }

  @OnEvent(CONTACT_INVITATION_EVENTS.ACCEPTED)
  async handleInvitationAccepted(event: ContactInvitationAcceptedEvent): Promise<void> {
    try {
      // Le payload ne porte pas le nom : on lit le profil User de celui qui a accepté
      const acceptor = await this.prisma.user.findUnique({
        where: { id: event.recipientUserId },
        select: { firstName: true, lastName: true },
      });

      if (!acceptor) {
        this.logger.debug(
          `User ${event.recipientUserId} not found, skipping CONTACT_INVITATION_ACCEPTED notification`,
        );
        return;
      }

      await this.notify(
        event.senderUserId,
        event.invitationId,
        NotificationType.CONTACT_INVITATION_ACCEPTED,
        {
          title: 'Invitation acceptée',
          body: `${acceptor.firstName} ${acceptor.lastName} a accepté votre invitation.`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send CONTACT_INVITATION_ACCEPTED notification for invitation ${event.invitationId}: ${String(error)}`,
      );
    }
  }

  private async notify(
    userId: string,
    invitationId: string,
    type: NotificationType,
    message: { title: string; body: string },
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: message.title,
        body: message.body,
        relatedLoanId: null,
      },
    });

    try {
      await this.notificationsService.sendPushToUsers([userId], message.title, message.body, {
        type: String(type),
        invitationId,
      });
    } catch (pushError) {
      this.logger.warn(
        `Push notification failed (in-app notification was created): ${String(pushError)}`,
      );
    }

    this.logger.log(`${type} notification sent to user ${userId} for invitation ${invitationId}`);
  }
}
