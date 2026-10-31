/**
 * Test stub for `expo-server-sdk`.
 *
 * The real package is pure ESM ("type": "module"), which ts-jest (CommonJS)
 * cannot load. FirebaseService is mocked in every suite except its own
 * (firebase.service.spec.ts, which provides its own jest.mock factory), so this
 * lightweight stub only needs to satisfy the module graph without running real
 * push logic.
 */
export class Expo {
  static isExpoPushToken(token: unknown): boolean {
    return typeof token === 'string' && token.startsWith('ExponentPushToken[');
  }

  chunkPushNotifications(messages: unknown[]): unknown[][] {
    return [messages];
  }

  sendPushNotificationsAsync(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

export type ExpoPushMessage = Record<string, unknown>;
export type ExpoPushTicket = Record<string, unknown>;
