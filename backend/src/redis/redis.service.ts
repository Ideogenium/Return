import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service Redis pour la gestion de la blacklist JWT.
 *
 * Responsabilités :
 * - Ajouter un token à la blacklist (avec TTL = durée restante du token)
 * - Vérifier si un token est blacklisté
 * - Marquer un compte supprimé, pour refuser ses access tokens encore valables (FIX-22)
 *
 * Sera réutilisé au Sprint 4 pour BullMQ (file de jobs rappels).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Retourne le client Redis brut (pour BullMQ, tests, etc.) */
  getClient(): Redis {
    return this.client;
  }

  // ─── JWT Blacklist ────────────────────────────────────────────

  /**
   * Ajoute un JWT à la blacklist Redis.
   *
   * @param jti - Identifiant unique du token (claim `jti` ou hash du token)
   * @param ttlSeconds - Durée de vie restante du token en secondes.
   *                      Le token est automatiquement supprimé après expiration.
   */
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(`bl:${jti}`, ttlSeconds, '1');
  }

  /**
   * Vérifie si un JWT est dans la blacklist.
   *
   * @param jti - Identifiant unique du token
   * @returns true si le token est blacklisté (= révoqué)
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(`bl:${jti}`);
    return result !== null;
  }

  // ─── Comptes supprimés (FIX-22, ADR 0010) ──────────────────────

  /**
   * Marque un compte supprimé : ses access tokens encore valables sont refusés.
   *
   * @param ttlSeconds - Au moins la durée de vie d'un access token, après quoi plus aucun
   *                     token émis avant la suppression ne peut être valide.
   */
  async markAccountDeleted(userId: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(`user-deleted:${userId}`, ttlSeconds, '1');
  }

  /**
   * Un access token est révoqué si son jti est blacklisté (logout, changement de mot de passe)
   * ou si son compte a été supprimé. Une seule lecture Redis (MGET) pour les deux.
   * Une erreur Redis remonte à l'appelant : la requête échoue plutôt que de laisser passer.
   */
  async isAccessRevoked(jti: string, userId: string): Promise<boolean> {
    const values = await this.client.mget(`bl:${jti}`, `user-deleted:${userId}`);
    return values.some((value) => value !== null);
  }
}
