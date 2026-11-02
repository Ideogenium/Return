import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthResponse } from './interfaces/auth-response.interface.js';
import type { AuthenticatedUser } from './strategies/jwt.strategy.js';
import { ThrottleByBodyField } from '../common/throttling/throttle-by-body-field.decorator.js';

// =============================================================================
// AuthController — Couche HTTP pour l'authentification
// =============================================================================
// Pas de logique métier ici (SRP). Le controller :
//   1. Reçoit la requête HTTP avec les DTOs validés (ValidationPipe global)
//   2. Délègue au service
//   3. Retourne la réponse avec le bon status HTTP
//
// Routes (préfixe global /v1 + prefix 'auth') :
//   POST /v1/auth/register   → 201 Created   (AuthResponse)
//   POST /v1/auth/login      → 200 OK        (AuthResponse)
//   POST /v1/auth/refresh    → 200 OK        (AuthResponse)
//   POST /v1/auth/logout     → 204 No Content
// =============================================================================

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /v1/auth/register
   *
   * Crée un nouvel utilisateur et retourne ses tokens d'authentification.
   * Le body est validé automatiquement par le ValidationPipe global.
   *
   * @returns 201 Created — AuthResponse avec accessToken, refreshToken et user
   * @throws 409 Conflict — Si l'email est déjà utilisé
   * @throws 400 Bad Request — Si le body est invalide (ValidationPipe)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * POST /v1/auth/login
   *
   * Authentifie un utilisateur existant par email + mot de passe.
   * Rate limiting renforcé : 10 tentatives / 15 min (protège contre le brute-force).
   *
   * @returns 200 OK — AuthResponse
   * @throws 401 Unauthorized — Si les identifiants sont invalides
   * @throws 429 Too Many Requests — Si le rate limit est atteint
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  // FIX-37: 10 attempts per 15 min per client IP AND email, so one client cannot lock the
  // login for everyone, nor for another account; plus 50 per 15 min per IP alone
  // (clientIpCeiling in AppModule) against password spraying.
  @ThrottleByBodyField('email')
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * POST /v1/auth/refresh
   *
   * Rafraîchit les tokens en utilisant un refresh token valide.
   * L'ancien refresh token est invalidé (rotation — sécurité).
   *
   * @returns 200 OK — AuthResponse avec nouveaux tokens
   * @throws 401 Unauthorized — Si le refresh token est invalide ou expiré
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * POST /v1/auth/logout
   *
   * Déconnecte l'utilisateur (conforme OpenAPI — pas de body) :
   * - Blackliste l'access token (claim jti) dans Redis
   * - Supprime TOUS les refresh tokens de l'utilisateur en base
   *
   * Requiert un Bearer token valide (JwtAuthGuard).
   *
   * @returns 204 No Content
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: { user: AuthenticatedUser }): Promise<void> {
    await this.authService.logout(req.user.userId, req.user.jti, req.user.tokenExp);
  }
}
