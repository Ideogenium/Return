import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { ConflictException } from '../common/exceptions/problem-details.exception.js';
import { ACTIVE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';

// =============================================================================
// AccountDeletionService — effacement d'un compte en base (FIX-22, ADR 0010)
// =============================================================================
// Un prêt clos fait aussi partie de l'historique de l'emprunteur. Les prêts clos encore
// visibles par un emprunteur (contact relié à un compte) sont donc conservés, et le compte
// devient une pierre tombale pseudonymisée. Sinon, le compte est supprimé entièrement.
// Tout se fait dans une seule transaction : en cas d'échec, rien n'est effacé.
// =============================================================================

/** Noms fixes d'un compte supprimé, enregistrés en base (contrat : `Compte` / `supprimé`). */
export const DELETED_ACCOUNT_FIRST_NAME = 'Compte';
export const DELETED_ACCOUNT_LAST_NAME = 'supprimé';

/** Adresse unique et non routable (RFC 2606) : l'adresse d'origine est libérée. */
export function deletedAccountEmail(userId: string): string {
  return `deleted+${userId}@deleted.invalid`;
}

/** Préférences remises aux valeurs par défaut du schéma. */
const DEFAULT_SETTINGS = {
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
} as const;

/** `deleted` : plus aucune trace ; `pseudonymised` : pierre tombale gardée pour ses prêts clos. */
export type AccountErasureOutcome = 'deleted' | 'pseudonymised';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AccountDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Efface le compte en base. Les contrôles (mot de passe, prêts en cours) sont faits avant
   * par l'appelant ; les prêts en cours sont revérifiés ici, dans la transaction, pour qu'un
   * prêt créé entre-temps ne soit jamais perdu.
   *
   * @param unusablePasswordHash - Hash d'un secret aléatoire jeté : aucun mot de passe ne le valide.
   * @throws ConflictException (409 active-loans-exist) si un prêt en cours existe
   */
  async erase(userId: string, unusablePasswordHash: string): Promise<AccountErasureOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const lenderLoans = await tx.loan.findMany({
        where: { lenderId: userId },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          itemId: true,
          borrowerId: true,
          borrower: { select: { userId: true } },
        },
      });

      const live = lenderLoans.filter((loan) => loan.deletedAt === null);
      if (live.some((loan) => ACTIVE_LOAN_STATUSES.includes(loan.status))) {
        throw new ConflictException(
          'active-loans-exist',
          'Active Loans Exist',
          'Cannot delete account while active loans exist. Please close all loans first.',
          '/v1/users/me',
        );
      }

      // Conservés : les prêts clos (CONTESTED compris) qu'un emprunteur relié à un compte voit encore.
      const kept = live.filter((loan) => loan.borrower.userId !== null);
      const keptIds = new Set(kept.map((loan) => loan.id));
      const droppedIds = lenderLoans.filter((loan) => !keptIds.has(loan.id)).map((l) => l.id);

      // Avant de supprimer des prêts : leurs notifications chez les autres utilisateurs le nomment.
      await this.deleteOthersLoanNotifications(
        tx,
        userId,
        lenderLoans.map((loan) => loan.id),
      );
      await this.deleteOthersInvitationNotifications();

      if (droppedIds.length > 0) {
        await tx.loan.deleteMany({ where: { id: { in: droppedIds } } });
      }

      // Ses emprunts : les contacts qui le représentaient chez d'autres prêteurs sont détachés.
      await tx.borrower.updateMany({ where: { userId }, data: { userId: null } });

      if (kept.length === 0) {
        // Plus aucun prêt ne le référence : suppression complète, les cascades font le reste.
        await tx.user.delete({ where: { id: userId } });
        return 'deleted';
      }

      await this.pseudonymise(tx, userId, unusablePasswordHash, kept);
      return 'pseudonymised';
    });
  }

  /** Notifications d'autres utilisateurs liées à un de ses prêts, comme prêteur ou emprunteur. */
  private async deleteOthersLoanNotifications(
    tx: Tx,
    userId: string,
    lenderLoanIds: string[],
  ): Promise<void> {
    const borrowed = await tx.loan.findMany({
      where: { borrower: { userId } },
      select: { id: true },
    });
    const loanIds = [...lenderLoanIds, ...borrowed.map((loan) => loan.id)];
    if (loanIds.length === 0) return;
    await tx.notification.deleteMany({
      where: { userId: { not: userId }, relatedLoanId: { in: loanIds } },
    });
  }

  /**
   * Notifications d'invitation d'autres utilisateurs qui le nomment : elles ne sont liées à aucun
   * prêt, seulement à leur acteur.
   *
   * TODO(FIX-22, #45) : dépend de la colonne interne `Notification.actorUserId` ajoutée par
   * FIX-27 (PR #45, pas encore dans main). Une fois #45 fusionnée :
   * `tx.notification.deleteMany({ where: { actorUserId: userId } })` pour la pierre tombale ;
   * la suppression complète est couverte par `onDelete: Cascade`. Aucune notification
   * d'invitation n'existe en prod avant FIX-27 : rien à rattraper.
   */
  private async deleteOthersInvitationNotifications(): Promise<void> {
    // Volontairement vide jusqu'à la fusion de #45 (voir ci-dessus) : recevra alors `tx` et `userId`.
  }

  /** Pierre tombale : la ligne `users` reste, sans aucune donnée d'origine. */
  private async pseudonymise(
    tx: Tx,
    userId: string,
    unusablePasswordHash: string,
    kept: { id: string; itemId: string; borrowerId: string }[],
  ): Promise<void> {
    const keptLoanIds = kept.map((loan) => loan.id);
    const keptItemIds = [...new Set(kept.map((loan) => loan.itemId))];
    const keptContactIds = [...new Set(kept.map((loan) => loan.borrowerId))];

    // Textes libres qu'il a écrits (règle unique de l'ADR) ; contestReason est écrit par l'emprunteur.
    await tx.loan.updateMany({ where: { id: { in: keptLoanIds } }, data: { notes: null } });

    await tx.photo.deleteMany({ where: { item: { userId } } });
    await tx.item.deleteMany({ where: { userId, id: { notIn: keptItemIds } } });
    await tx.item.updateMany({ where: { id: { in: keptItemIds } }, data: { description: null } });

    await tx.borrower.deleteMany({
      where: { lenderUserId: userId, id: { notIn: keptContactIds } },
    });
    await tx.borrower.updateMany({
      where: { id: { in: keptContactIds } },
      data: { phoneNumber: null },
    });

    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.deviceToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.contactInvitation.deleteMany({
      where: { OR: [{ senderUserId: userId }, { recipientUserId: userId }] },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: DELETED_ACCOUNT_FIRST_NAME,
        lastName: DELETED_ACCOUNT_LAST_NAME,
        email: deletedAccountEmail(userId),
        password: unusablePasswordHash,
        phone: null,
        profilePicture: null,
        lastLoginAt: null,
        ...DEFAULT_SETTINGS,
        deletedAt: new Date(),
      },
    });
  }
}
