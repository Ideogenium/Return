import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { USER_EVENTS } from '../common/events/user.events.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  ConflictException,
  UnauthorizedException,
} from '../common/exceptions/problem-details.exception.js';
import { toSafeUser } from '../common/mappers/user.mapper.js';
import { isPrismaUniqueConstraintError } from '../common/utils/prisma-errors.util.js';
import { accessTokenTtlSeconds, parseDurationMs } from '../common/utils/duration.util.js';
import type { AuthResponse, TokenPair } from './interfaces/auth-response.interface.js';
import type { User } from '@prisma/client';

// =============================================================================
// AuthService — Gestion complète de l'authentification
// =============================================================================
// Responsabilités (SRP) :
//   - Inscription (register) : hachage bcrypt + création utilisateur + tokens
//   - Connexion (login) : vérification credentials + génération tokens
//   - Rafraîchissement (refreshTokens) : rotation du refresh token
//   - Déconnexion (logout) : blacklist Redis + suppression refresh token
//
// Sécurité :
//   - Mots de passe hachés avec bcrypt (12 rounds — ADR-004)
//   - Access tokens JWT avec claim `jti` pour blacklist individuelle
//   - Refresh tokens opaques (crypto.randomBytes), stockés hachés en SHA-256
//   - Rotation systématique des refresh tokens (chaque refresh en crée un nouveau)
//   - Blacklist Redis avec TTL = durée de vie restante du token
// =============================================================================

@Injectable()
export class AuthService {
  /** Nombre de rounds bcrypt (cf. ADR-004 dans 01_ARCHITECTURE_TECHNIQUE.md) */
  private readonly BCRYPT_ROUNDS = 12;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===========================================================================
  // PUBLIC — Endpoints Auth
  // ===========================================================================

  /**
   * Inscrit un nouvel utilisateur.
   *
   * Flux :
   * 1. Hache le mot de passe avec bcrypt (12 rounds)
   * 2. Crée l'utilisateur en base (email unique)
   * 3. Génère un access token JWT + un refresh token opaque
   * 4. Stocke le refresh token haché (SHA-256) en base
   * 5. Retourne AuthResponse avec les tokens et les données utilisateur
   *
   * @throws ConflictException (409) si l'email est déjà pris
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // 1. Hachage du mot de passe (coûteux — 12 rounds ≈ 250ms)
    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // 2. Création de l'utilisateur
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
    } catch (error: unknown) {
      // Prisma P2002 = violation de contrainte unique (email)
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException(
          'email-already-exists',
          'Email Already Exists',
          `The email '${dto.email}' is already registered.`,
          '/v1/auth/register',
        );
      }
      throw error;
    }

    this.logger.log(`User registered: ${user.id}`);

    // Événement métier (découplage inter-modules — SRP/OCP)
    // Les listeners (notifications, analytics...) seront ajoutés dans les sprints suivants
    this.eventEmitter.emit(USER_EVENTS.REGISTERED, {
      userId: user.id,
      email: user.email,
    });

    // 3-4. Génération et stockage des tokens
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // 5. Réponse
    return this.buildAuthResponse(user, tokens);
  }

  /**
   * Authentifie un utilisateur existant.
   *
   * Flux :
   * 1. Recherche l'utilisateur par email
   * 2. Vérifie le mot de passe avec bcrypt.compare
   * 3. Met à jour lastLoginAt
   * 4. Génère les tokens (access + refresh)
   * 5. Retourne AuthResponse
   *
   * @throws UnauthorizedException (401) si email ou mot de passe invalide
   *         (même message pour ne pas révéler l'existence du compte)
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    // 1. Recherche par email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Un compte supprimé (pierre tombale, FIX-22) répond comme un compte inexistant.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(
        'invalid-credentials',
        'Invalid Credentials',
        'Email or password is incorrect.',
        '/v1/auth/login',
      );
    }

    // 2. Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'invalid-credentials',
        'Invalid Credentials',
        'Email or password is incorrect.',
        '/v1/auth/login',
      );
    }

    // 3. Mise à jour du dernier login (on récupère le résultat pour la réponse)
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${updatedUser.id}`);

    // Événement métier (découplage inter-modules)
    this.eventEmitter.emit(USER_EVENTS.LOGGED_IN, { userId: updatedUser.id });

    // 4-5. Tokens + réponse
    const tokens = await this.generateTokenPair(
      updatedUser.id,
      updatedUser.email,
      updatedUser.role,
    );
    await this.storeRefreshToken(updatedUser.id, tokens.refreshToken);

    return this.buildAuthResponse(updatedUser, tokens);
  }

  /**
   * Rafraîchit les tokens d'un utilisateur (rotation du refresh token).
   *
   * Flux :
   * 1. Hache le refresh token reçu (SHA-256) pour le chercher en base
   * 2. Vérifie l'existence et la validité (non expiré)
   * 3. Supprime l'ancien refresh token (token rotation — sécurité)
   * 4. Génère une nouvelle paire de tokens
   * 5. Retourne AuthResponse
   *
   * @throws UnauthorizedException (401) si le refresh token est invalide ou expiré
   */
  async refreshTokens(rawRefreshToken: string): Promise<AuthResponse> {
    const hashedToken = this.hashToken(rawRefreshToken);

    // 1. Recherche du refresh token en base
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'invalid-refresh-token',
        'Invalid Token',
        'The refresh token is invalid or has been revoked.',
        '/v1/auth/refresh',
      );
    }

    // 2. Vérification de l'expiration
    if (storedToken.expiresAt < new Date()) {
      // Nettoyage du token expiré
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      throw new UnauthorizedException(
        'invalid-refresh-token',
        'Invalid Token',
        'The refresh token has expired.',
        '/v1/auth/refresh',
      );
    }

    // 3. Suppression de l'ancien token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Récupération des données utilisateur pour la réponse
    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    // Sécurité : si l'utilisateur a été supprimé entre-temps (ou gardé en pierre tombale, FIX-22)
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(
        'invalid-refresh-token',
        'Invalid Token',
        'The user associated with this token no longer exists.',
        '/v1/auth/refresh',
      );
    }

    // 4-5. Nouveaux tokens + réponse
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return this.buildAuthResponse(user, tokens);
  }

  /**
   * Déconnecte un utilisateur.
   *
   * Flux (conforme à l'OpenAPI — POST /auth/logout sans body) :
   * 1. Blackliste le jti de l'access token dans Redis (TTL = durée restante)
   * 2. Supprime TOUS les refresh tokens de l'utilisateur en base
   *
   * Le blacklisting Redis garantit que même si le client conserve l'access token,
   * il sera rejeté par le JwtStrategy à chaque requête.
   * La suppression de tous les refresh tokens force une reconnexion complète.
   *
   * @param userId - ID de l'utilisateur (depuis le JWT validé)
   * @param jti    - Identifiant unique de l'access token (claim JWT `jti`)
   * @param exp    - Timestamp d'expiration de l'access token (claim JWT `exp`)
   */
  async logout(userId: string, jti: string, exp: number): Promise<void> {
    // 1. Blacklist de l'access token avec TTL = temps restant
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.blacklistToken(jti, ttl);
    }

    // 2. Suppression de TOUS les refresh tokens de l'utilisateur
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`User logged out: ${userId}`);
  }

  // ===========================================================================
  // PRIVATE — Helpers internes
  // ===========================================================================

  /**
   * Génère une paire de tokens : JWT access + refresh opaque.
   *
   * L'access token inclut un claim `jti` (JWT ID) unique pour permettre
   * la révocation individuelle via la blacklist Redis.
   * Le claim `role` évite un appel DB par requête pour vérifier le rôle.
   */
  private async generateTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const jti = randomUUID();

    // Access token — JWT signé avec le secret configuré
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
      role,
      jti,
    });

    // Refresh token — opaque, 32 bytes aléatoires en hex (64 chars)
    // Stocké haché en SHA-256 en base, la version brute est envoyée au client
    const refreshToken = randomBytes(32).toString('hex');

    return { accessToken, refreshToken };
  }

  /**
   * Stocke un refresh token haché en base de données.
   *
   * @param userId - ID de l'utilisateur propriétaire
   * @param rawToken - Token brut (avant hachage)
   */
  private async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.getRefreshExpirationMs());

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
      },
    });
  }

  /**
   * Hache un token avec SHA-256 (déterministe, contrairement à bcrypt).
   *
   * Utilisé pour les refresh tokens car on a besoin de chercher par hash
   * en base de données (bcrypt génère un hash différent à chaque appel).
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Construit l'objet AuthResponse à partir d'un User et d'une paire de tokens.
   * Le mot de passe est systématiquement exclu (SafeUser via toSafeUser).
   */
  private buildAuthResponse(user: User, tokens: TokenPair): AuthResponse {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getAccessExpirationSeconds(),
      tokenType: 'Bearer',
      user: toSafeUser(user),
    };
  }

  // --- Parsers de configuration JWT ---

  /**
   * Parse la durée d'expiration du refresh token depuis la config.
   * Format attendu : "30d", "7d", "1h", etc.
   * @returns Durée en millisecondes
   */
  private getRefreshExpirationMs(): number {
    const exp = this.config.get<string>('JWT_REFRESH_EXPIRATION', '30d');
    return parseDurationMs(exp, 30 * 24 * 60 * 60 * 1000);
  }

  /** Durée de vie de l'access token en secondes (champ `expiresIn` de AuthResponse). */
  private getAccessExpirationSeconds(): number {
    return accessTokenTtlSeconds(this.config);
  }
}
