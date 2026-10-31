// =============================================================================
// Loan Events — Contrats d'événements pour la communication inter-modules
// =============================================================================
// Ces événements sont émis par le module Loans (Sprint 4) et écoutés par le
// module Borrowers pour mettre à jour les statistiques dénormalisées
// (trustScore, totalLoans).
//
// Architecture : EventEmitter2 + @OnEvent (Observer/Event-Driven pattern)
// Ref : copilot-instructions.md §Design Patterns
// =============================================================================

/**
 * Nom des événements loan émis via EventEmitter2.
 *
 * Usage futur (Sprint 4) :
 * ```ts
 * this.eventEmitter.emit(LOAN_EVENTS.STATUS_CHANGED, payload);
 * ```
 */
export const LOAN_EVENTS = {
  /** Émis quand un nouveau prêt est créé */
  CREATED: 'loan.created',

  /** Émis quand le statut d'un prêt change (ex: ACTIVE → RETURNED) */
  STATUS_CHANGED: 'loan.status.changed',

  /** Émis quand un prêt est supprimé */
  DELETED: 'loan.deleted',

  /** Émis quand la date de retour d'un prêt ouvert change (les rappels sont replanifiés) */
  RETURN_DATE_CHANGED: 'loan.return-date.changed',
} as const;

/**
 * Payload émis lors du changement de la date de retour d'un prêt ouvert.
 *
 * Le module Reminders écoute cet événement pour replanifier les rappels.
 */
export interface LoanReturnDateChangedEvent {
  /** ID du prêt concerné */
  loanId: string;

  /** Nouvelle date de retour (null si l'échéance est supprimée) */
  returnDate: Date | null;

  /** Instant du changement : base de la nouvelle planification */
  changedAt: Date;
}

/**
 * Payload émis lors de la création d'un prêt.
 *
 * Le module Borrowers écoute cet événement pour incrémenter `totalLoans`.
 */
export interface LoanCreatedEvent {
  /** ID du prêt créé */
  loanId: string;

  /** ID de l'emprunteur associé au prêt */
  borrowerId: string;

  /** ID du prêteur (propriétaire du prêt) */
  lenderUserId: string;

  /** Date de retour prévue (null si prêt sans échéance) */
  returnDate: Date | null;

  /** Date de création du prêt */
  createdAt: Date;
}

/**
 * Payload émis lors d'un changement de statut d'un prêt.
 *
 * Le module Borrowers écoute cet événement pour recalculer `trustScore`.
 *
 * Formule trustScore (OpenAPI) :
 *   (returnedOnTime * 100 + returnedLate * 50) / totalLoans
 */
export interface LoanStatusChangedEvent {
  /** ID du prêt concerné */
  loanId: string;

  /** ID de l'emprunteur associé au prêt */
  borrowerId: string;

  /** ID du prêteur (propriétaire du prêt) */
  lenderUserId: string;

  /** Ancien statut du prêt */
  previousStatus: string;

  /** Nouveau statut du prêt */
  newStatus: string;
}

/**
 * Payload émis lors de la suppression d'un prêt.
 *
 * Le module Borrowers écoute cet événement pour décrémenter `totalLoans`
 * et recalculer `trustScore`.
 */
export interface LoanDeletedEvent {
  /** ID du prêt supprimé */
  loanId: string;

  /** ID de l'emprunteur associé au prêt */
  borrowerId: string;

  /** ID du prêteur (propriétaire du prêt) */
  lenderUserId: string;

  /** Dernier statut du prêt avant suppression */
  lastStatus: string;
}
