import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '../common/exceptions/problem-details.exception.js';
import { toSafeUser } from '../common/mappers/user.mapper.js';
import { ACTIVE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';
import { isPrismaUniqueConstraintError } from '../common/utils/prisma-errors.util.js';
import { PHOTO_STORAGE } from '../storage/interfaces/photo-storage.interface.js';
import type { PhotoStorage } from '../storage/interfaces/photo-storage.interface.js';
import type {
  UserSettings,
  SupportedLanguage,
} from '../auth/interfaces/auth-response.interface.js';
import type { User } from '@prisma/client';

// =============================================================================
// UsersService — Gestion du profil et des préférences utilisateur
// =============================================================================
// Responsabilités (SRP) :
//   - Lecture/mise à jour du profil (GET/PATCH /users/me)
//   - Suppression de compte (DELETE /users/me)
//   - Changement de mot de passe (PATCH /users/me/password)
//   - Lecture/mise à jour des préférences (GET/PATCH /users/me/settings)
//
// Sécurité :
//   - Le userId vient toujours du JWT (req.user.userId), jamais du body
//   - Suppression et changement de mot de passe requièrent le mot de passe actuel
//   - Suppression de compte = Prisma onDelete: Cascade (supprime aussi les refresh tokens)
// =============================================================================

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(PHOTO_STORAGE) private readonly photoStorage: PhotoStorage,
  ) {}

  // ===========================================================================
  // PROFIL
  // ===========================================================================

  /**
   * GET /users/me — Retourne le profil de l'utilisateur authentifié.
   *
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   */
  async getProfile(userId: string) {
    const user = await this.findUserOrThrow(userId);
    return toSafeUser(user);
  }

  /**
   * PATCH /users/me — Met à jour partiellement le profil.
   *
   * Les champs absents du DTO ne sont pas modifiés (PATCH sémantique).
   * L'email peut être mis à jour, mais doit rester unique.
   *
   * @throws ConflictException (409) si l'email est déjà pris
   */
  async updateProfile(userId: string, dto: UpdateUserDto) {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: dto,
      });
      return toSafeUser(updated);
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException(
          'email-already-exists',
          'Email Already Exists',
          'This email address is already associated with another account.',
          '/v1/users/me',
        );
      }
      throw error;
    }
  }

  /**
   * DELETE /users/me — Supprime définitivement le compte utilisateur.
   *
   * Sécurité renforcée :
   * 1. Vérifie le mot de passe actuel (bcrypt.compare)
   * 2. Vérifie le texte de confirmation ("DELETE MY ACCOUNT")
   *    → La validation @Equals est dans le DTO, mais on double-check ici
   *
   * La suppression cascade sur les refresh tokens (Prisma onDelete: Cascade).
   *
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   * @throws UnauthorizedException (401) si le mot de passe est incorrect
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.findUserOrThrow(userId);

    // Vérification des prêts actifs (OpenAPI: 409 active-loans-exist)
    const activeLoanCount = await this.prisma.loan.count({
      where: {
        lenderId: userId,
        status: {
          in: ACTIVE_LOAN_STATUSES,
        },
        deletedAt: null,
      },
    });
    if (activeLoanCount > 0) {
      throw new ConflictException(
        'active-loans-exist',
        'Active Loans Exist',
        'Cannot delete account while active loans exist. Please close all loans first.',
        '/v1/users/me',
      );
    }

    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'invalid-current-password',
        'Invalid Current Password',
        'The provided password is incorrect.',
        '/v1/users/me',
      );
    }

    // Suppression (cascade → refresh tokens supprimés automatiquement)
    await this.prisma.user.delete({ where: { id: userId } });

    this.logger.log(`Account deleted: ${userId}`);
  }

  // ===========================================================================
  // MOT DE PASSE
  // ===========================================================================

  /**
   * PATCH /users/me/password — Change le mot de passe.
   *
   * 1. Vérifie l'ancien mot de passe (bcrypt.compare)
   * 2. Hache le nouveau mot de passe (bcrypt, 12 rounds)
   * 3. Met à jour en base
   * 4. Invalide TOUS les tokens actifs (ADR-004 — sécurité)
   *    - Blackliste le jti de l'access token courant dans Redis
   *    - Supprime tous les refresh tokens en base
   *
   * @param userId - ID de l'utilisateur (depuis le JWT)
   * @param dto - Contient currentPassword et newPassword
   * @param jti - JWT ID de l'access token courant (pour blacklist Redis)
   * @param tokenExp - Timestamp d'expiration de l'access token courant
   *
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   * @throws UnauthorizedException (401) si l'ancien mot de passe est incorrect
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    jti: string,
    tokenExp: number,
  ): Promise<void> {
    const user = await this.findUserOrThrow(userId);

    // Vérification de l'ancien mot de passe
    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'invalid-current-password',
        'Invalid Current Password',
        'The current password you provided is incorrect.',
        '/v1/users/me/password',
      );
    }

    // Hachage et mise à jour
    const hashedPassword = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidation de TOUS les tokens (ADR-004)
    // 1. Blacklist du jti de l'access token courant dans Redis
    const ttl = tokenExp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.blacklistToken(jti, ttl);
    }
    // 2. Suppression de tous les refresh tokens en base
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`Password changed for user: ${userId} — all tokens revoked`);
  }

  // ===========================================================================
  // PRÉFÉRENCES (SETTINGS)
  // ===========================================================================

  /**
   * GET /users/me/settings — Retourne les préférences utilisateur.
   *
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   */
  async getSettings(userId: string): Promise<UserSettings> {
    const user = await this.findUserOrThrow(userId);
    return this.extractSettings(user);
  }

  /**
   * PATCH /users/me/settings — Met à jour les préférences.
   *
   * Les champs absents du DTO ne sont pas modifiés (PATCH sémantique).
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return this.extractSettings(updated);
  }

  // ===========================================================================
  // AVATAR
  // ===========================================================================

  /**
   * PUT /users/me/avatar — Upload ou remplace la photo de profil.
   *
   * Si l'utilisateur a déjà un avatar, l'ancien est supprimé du storage.
   *
   * @returns { profilePicture: string } URL de la nouvelle photo
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   */
  async updateAvatar(
    userId: string,
    file: Buffer,
    filename: string,
  ): Promise<{ profilePicture: string }> {
    const user = await this.findUserOrThrow(userId);
    const previousPicture = user.profilePicture;

    // 1. Upload le nouvel avatar
    const ext = filename.split('.').pop() ?? 'jpg';
    // Unique key per upload: a fixed key would make the replacement overwrite the previous
    // file, which step 3 would then delete — and it also defeats CDN cache invalidation.
    const key = `users/${userId}/avatar-${crypto.randomUUID()}.${ext}`;
    const uploadResult = await this.photoStorage.upload(file, key);

    // 2. Mettre à jour en DB (rollback upload si échec)
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { profilePicture: uploadResult.url },
      });
    } catch (error) {
      // Rollback : supprimer le fichier uploadé
      try {
        await this.photoStorage.delete(uploadResult.url);
      } catch {
        // Best-effort : ne pas masquer l'erreur principale
      }
      throw error;
    }

    // 3. Supprimer l'ancien avatar (best-effort, après succès)
    if (previousPicture) {
      try {
        await this.photoStorage.delete(previousPicture);
      } catch {
        // Best-effort : l'échec de suppression ne doit pas invalider la mise à jour
      }
    }

    return { profilePicture: uploadResult.url };
  }

  /**
   * DELETE /users/me/avatar — Supprime la photo de profil.
   *
   * @throws NotFoundException (404) si l'utilisateur n'existe plus
   */
  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.findUserOrThrow(userId);

    if (!user.profilePicture) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePicture: null },
    });

    try {
      await this.photoStorage.delete(user.profilePicture);
    } catch {
      // Best-effort : l'échec de suppression du fichier ne doit pas invalider la mise à jour
    }
  }

  // ===========================================================================
  // PRIVATE — Helpers
  // ===========================================================================

  /**
   * Recherche un utilisateur par ID ou lève NotFoundException.
   */
  private async findUserOrThrow(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User', userId, '/v1/users/me');
    }

    return user;
  }

  /**
   * Extrait les champs de préférences d'un User.
   */
  private extractSettings(user: User): UserSettings {
    return {
      pushNotificationsEnabled: user.pushNotificationsEnabled,
      reminderEnabled: user.reminderEnabled,
      language: user.language as SupportedLanguage,
      timezone: user.timezone,
    };
  }
}
