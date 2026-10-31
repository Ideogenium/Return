import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';

/**
 * Push notification sender.
 *
 * CORR-13 / Option B (doc 14): we send through the Expo Push Service
 * (`expo-server-sdk`), which relays to FCM (Android) and APNs (iOS). The front
 * registers `ExpoPushToken`s, so no native FCM token handling is needed.
 *
 * NOTE: the class is still named `FirebaseService` on purpose — its injection
 * token and public signatures (`isAvailable`, `sendToMultipleTokens`) are kept
 * identical so `notifications.service.ts` is untouched. A rename to `PushService`
 * would be a separate, mechanical refactor.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly expo: Expo;

  constructor(private readonly configService: ConfigService) {
    // accessToken is optional — it only lifts the anonymous rate limit.
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  /**
   * The Expo client needs no mandatory credentials, so the sender is always
   * available (contrast with the old Firebase impl that required a service
   * account). The `notifications.service` guard therefore never short-circuits.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Send a push to many device tokens. Returns the list of **invalid** tokens
   * (malformed or `DeviceNotRegistered`) so the caller can purge them — this is
   * the contract consumed by `notifications.service.ts`.
   */
  async sendToMultipleTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string[]> {
    if (tokens.length === 0) return [];

    const invalidTokens: string[] = [];
    const validTokens: string[] = [];

    for (const token of tokens) {
      if (Expo.isExpoPushToken(token)) {
        validTokens.push(token);
      } else {
        invalidTokens.push(token);
        this.logger.warn(`Invalid Expo push token detected: ${this.mask(token)}`);
      }
    }

    if (validTokens.length === 0) return invalidTokens;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      ...(data && { data }),
    }));

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);

        tickets.forEach((ticket, idx) => {
          const token = chunk[idx].to as string;
          if (ticket.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(token);
              this.logger.warn(`Expo token unregistered: ${this.mask(token)}`);
            } else {
              this.logger.error(
                `Expo push failed for ${this.mask(token)}: ${ticket.details?.error ?? ticket.message}`,
              );
            }
          }
        });
      } catch (error) {
        // Transient transport error: keep the tokens, do not purge.
        this.logger.error(
          `Expo push chunk failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    return invalidTokens;
  }

  private mask(token: string): string {
    return token.length <= 10 ? token : `${token.slice(0, 6)}…${token.slice(-4)}`;
  }
}
