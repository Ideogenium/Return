// =============================================================================
// Contact Invitation Events — Contrats d'événements inter-modules
// =============================================================================
// Ces événements sont émis par le module ContactInvitations et écoutés par
// d'autres modules (Notifications...) pour réagir aux actions d'invitation.
//
// Architecture : EventEmitter2 + @OnEvent (Observer/Event-Driven pattern)
// Ref : copilot-instructions.md §Design Patterns
// =============================================================================

/**
 * Nom des événements contact-invitation émis via EventEmitter2.
 *
 * Usage :
 * ```ts
 * this.eventEmitter.emit(CONTACT_INVITATION_EVENTS.ACCEPTED, payload);
 * ```
 */
export const CONTACT_INVITATION_EVENTS = {
  /** Émis quand une invitation de contact vient d'être créée (envoyée au destinataire) */
  SENT: 'contact-invitation.sent',

  /** Émis quand une invitation de contact est acceptée par le destinataire */
  ACCEPTED: 'contact-invitation.accepted',

  /** Émis quand une invitation de contact est rejetée par le destinataire */
  REJECTED: 'contact-invitation.rejected',
} as const;

/**
 * Payload émis lors de l'envoi d'une invitation de contact.
 *
 * Le module Notifications écoute cet événement (ContactInvitationNotificationListener)
 * pour notifier le destinataire (CONTACT_INVITATION_RECEIVED).
 */
export interface ContactInvitationSentEvent {
  /** ID de l'invitation créée */
  invitationId: string;

  /** ID de l'émetteur de l'invitation */
  senderUserId: string;

  /** ID du destinataire, à notifier */
  recipientUserId: string;

  /** Prénom du profil User de l'émetteur (jamais une donnée saisie dans ses contacts) */
  senderFirstName: string;

  /** Nom du profil User de l'émetteur */
  senderLastName: string;
}

/**
 * Payload émis lors de l'acceptation d'une invitation de contact.
 *
 * Le module Notifications écoute cet événement (ContactInvitationNotificationListener)
 * pour notifier l'émetteur que son invitation a été acceptée.
 */
export interface ContactInvitationAcceptedEvent {
  /** ID de l'invitation acceptée */
  invitationId: string;

  /** ID de l'émetteur (prêteur) */
  senderUserId: string;

  /** ID du destinataire (emprunteur) qui a accepté */
  recipientUserId: string;

  /** Email du destinataire */
  recipientEmail: string;

  /** ID du Borrower créé automatiquement chez l'émetteur */
  borrowerId: string;
}

/**
 * Payload émis lors du rejet d'une invitation de contact.
 *
 * Aucun écouteur n'est volontairement branché sur cet événement : par décision du contrat,
 * le refus d'une invitation ne déclenche pas de notification à l'émetteur.
 */
export interface ContactInvitationRejectedEvent {
  /** ID de l'invitation rejetée */
  invitationId: string;

  /** ID de l'émetteur (prêteur) */
  senderUserId: string;

  /** ID du destinataire qui a rejeté */
  recipientUserId: string;
}
