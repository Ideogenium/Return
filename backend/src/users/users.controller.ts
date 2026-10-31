import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { mimeToExtension } from '../common/utils/mime.util.js';
import { TrustScoreService } from '../trust-score/trust-score.service.js';
import type { GlobalTrustScore } from '../trust-score/trust-score.service.js';
import type { SafeUser, UserSettings } from '../auth/interfaces/auth-response.interface.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

// =============================================================================
// UsersController — Endpoints profil et préférences
// =============================================================================
// Tous les endpoints requièrent un Bearer token (JwtAuthGuard).
// Le userId est TOUJOURS extrait du JWT (req.user.userId), jamais du body.
//
// Routes (préfixe global /v1 + prefix 'users') :
//   GET    /v1/users/me           → 200 OK           (SafeUser)
//   PATCH  /v1/users/me           → 200 OK           (SafeUser)
//   DELETE /v1/users/me           → 204 No Content
//   PATCH  /v1/users/me/password  → 204 No Content
//   PUT    /v1/users/me/avatar    → 200 OK           ({ profilePicture })
//   GET    /v1/users/me/settings  → 200 OK           (UserSettings)
//   PATCH  /v1/users/me/settings  → 200 OK           (UserSettings)
// =============================================================================

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  /**
   * GET /v1/users/me
   *
   * Retourne le profil complet de l'utilisateur authentifié.
   *
   * @returns 200 OK — SafeUser (sans password)
   * @throws 404 Not Found — Utilisateur introuvable (supprimé entre-temps)
   */
  @Get('me')
  async getProfile(@Request() req: { user: AuthenticatedUser }): Promise<SafeUser> {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * GET /v1/users/me/trust-score
   *
   * FIX-15: global trust score of the authenticated user as a borrower,
   * aggregated across all lenders. Single source of truth for the score shown
   * on the user's own profile.
   *
   * @returns 200 OK — GlobalTrustScore
   */
  @Get('me/trust-score')
  async getMyTrustScore(@Request() req: { user: AuthenticatedUser }): Promise<GlobalTrustScore> {
    return this.trustScoreService.computeGlobalTrustScore(req.user.userId);
  }

  /**
   * PATCH /v1/users/me
   *
   * Met à jour partiellement le profil (firstName, lastName, email).
   *
   * @returns 200 OK — SafeUser mis à jour
   * @throws 409 Conflict — Si l'email est déjà utilisé
   */
  @Patch('me')
  async updateProfile(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  /**
   * DELETE /v1/users/me
   *
   * Supprime définitivement le compte. Requiert le mot de passe actuel
   * et le texte de confirmation "DELETE MY ACCOUNT".
   *
   * @returns 204 No Content
   * @throws 401 Unauthorized — Mot de passe incorrect
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.usersService.deleteAccount(req.user.userId, dto);
  }

  /**
   * PATCH /v1/users/me/password
   *
   * Change le mot de passe. Requiert le mot de passe actuel.
   * Invalide TOUS les tokens actifs après le changement (ADR-004).
   *
   * @returns 204 No Content
   * @throws 401 Unauthorized — Mot de passe actuel incorrect
   */
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(req.user.userId, dto, req.user.jti, req.user.tokenExp);
  }

  /**
   * PUT /v1/users/me/avatar
   *
   * Upload ou remplace la photo de profil (JPEG/PNG, max 2MB).
   *
   * @returns 200 OK — { profilePicture: string }
   * @throws 400 Bad Request — Format invalide ou fichier trop volumineux
   */
  @Put('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAvatar(
    @Request() req: { user: AuthenticatedUser },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ profilePicture: string }> {
    const safeFilename = `avatar.${mimeToExtension(file.mimetype)}`;
    return this.usersService.updateAvatar(req.user.userId, file.buffer, safeFilename);
  }

  /**
   * DELETE /v1/users/me/avatar
   *
   * Supprime la photo de profil de l'utilisateur.
   *
   * @returns 204 No Content
   */
  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@Request() req: { user: AuthenticatedUser }): Promise<void> {
    await this.usersService.deleteAvatar(req.user.userId);
  }

  /**
   * GET /v1/users/me/settings
   *
   * Retourne les préférences de l'utilisateur.
   *
   * @returns 200 OK — UserSettings
   */
  @Get('me/settings')
  async getSettings(@Request() req: { user: AuthenticatedUser }): Promise<UserSettings> {
    return this.usersService.getSettings(req.user.userId);
  }

  /**
   * PATCH /v1/users/me/settings
   *
   * Met à jour partiellement les préférences.
   *
   * @returns 200 OK — UserSettings mis à jour
   */
  @Patch('me/settings')
  async updateSettings(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    return this.usersService.updateSettings(req.user.userId, dto);
  }
}
