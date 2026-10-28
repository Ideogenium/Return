// =============================================================================
// Prisma Error Utilities — Type guards partagés pour les erreurs Prisma
// =============================================================================
// Centralise les vérifications d'erreurs Prisma pour respecter le DRY.
// Utilisé par AuthService et UsersService.
// =============================================================================

/**
 * Vérifie si une erreur Prisma est une violation de contrainte unique (P2002).
 *
 * Prisma lève ce code quand un INSERT/UPDATE viole un @unique ou @@unique.
 * Utilisé pour détecter les doublons d'email à l'inscription ou la mise à jour.
 */
export function isPrismaUniqueConstraintError(error: unknown): error is Error & { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

/**
 * Vérifie si une erreur Prisma signale qu'aucun enregistrement ne correspond (P2025).
 *
 * Levée par `update` quand son `where` (y compris un filtre de statut) ne trouve rien.
 */
export function isPrismaRecordNotFoundError(error: unknown): error is Error & { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  );
}
