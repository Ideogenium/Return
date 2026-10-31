import { ConfigService } from '@nestjs/config';

import { Expo } from 'expo-server-sdk';
import { FirebaseService } from './firebase.service.js';

// =============================================================================
// Mock expo-server-sdk
// =============================================================================
// The shared jest.fn()s are attached to the mocked Expo class so the tests can
// drive the instance methods created by `new Expo()` inside the service.

jest.mock('expo-server-sdk', () => {
  const chunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);
  const sendPushNotificationsAsync = jest.fn();
  const isExpoPushToken = jest.fn(
    (t: unknown) => typeof t === 'string' && t.startsWith('ExponentPushToken['),
  );

  const ExpoMock = jest.fn().mockImplementation(() => ({
    chunkPushNotifications,
    sendPushNotificationsAsync,
  }));
  (ExpoMock as unknown as { isExpoPushToken: jest.Mock }).isExpoPushToken = isExpoPushToken;
  (ExpoMock as unknown as { __mocks: Record<string, jest.Mock> }).__mocks = {
    chunkPushNotifications,
    sendPushNotificationsAsync,
    isExpoPushToken,
  };

  return { __esModule: true, Expo: ExpoMock };
});

const mocks = (
  Expo as unknown as {
    __mocks: {
      chunkPushNotifications: jest.Mock;
      sendPushNotificationsAsync: jest.Mock;
      isExpoPushToken: jest.Mock;
    };
  }
).__mocks;

// =============================================================================
// Fixtures
// =============================================================================

const TITLE = 'Rappel jour J';
const BODY = 'Vous avez un rappel concernant un objet emprunté.';

const TOKEN_1 = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const TOKEN_2 = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';
const MALFORMED = 'not-an-expo-token';

const okTicket = (id = 'ticket-id') => ({ status: 'ok', id });
const errorTicket = (error: string) => ({ status: 'error', message: error, details: { error } });

// =============================================================================
// Test Suite — FirebaseService (Expo Push, CORR-13 option B)
// =============================================================================

describe('FirebaseService', () => {
  let service: FirebaseService;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue(undefined) };

    mocks.chunkPushNotifications.mockReset().mockImplementation((m: unknown[]) => [m]);
    mocks.sendPushNotificationsAsync.mockReset().mockResolvedValue([]);
    mocks.isExpoPushToken
      .mockReset()
      .mockImplementation(
        (t: unknown) => typeof t === 'string' && t.startsWith('ExponentPushToken['),
      );

    service = new FirebaseService(configService as unknown as ConfigService);
  });

  describe('isAvailable', () => {
    it('should always be available, even without an EXPO_ACCESS_TOKEN', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('sendToMultipleTokens', () => {
    it('should send one message per valid token and return no invalid tokens', async () => {
      mocks.sendPushNotificationsAsync.mockResolvedValue([okTicket('1'), okTicket('2')]);

      const result = await service.sendToMultipleTokens([TOKEN_1, TOKEN_2], TITLE, BODY);

      expect(mocks.sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
      const sentMessages = mocks.sendPushNotificationsAsync.mock.calls[0][0];
      expect(sentMessages).toEqual([
        expect.objectContaining({
          to: TOKEN_1,
          title: TITLE,
          body: BODY,
          channelId: 'default',
          priority: 'high',
          sound: 'default',
        }),
        expect.objectContaining({ to: TOKEN_2 }),
      ]);
      expect(result).toEqual([]);
    });

    it('should filter out malformed tokens and report them as invalid', async () => {
      mocks.sendPushNotificationsAsync.mockResolvedValue([okTicket()]);

      const result = await service.sendToMultipleTokens([TOKEN_1, MALFORMED], TITLE, BODY);

      const sentMessages = mocks.sendPushNotificationsAsync.mock.calls[0][0];
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].to).toBe(TOKEN_1);
      expect(result).toEqual([MALFORMED]);
    });

    it('should return tokens reported as DeviceNotRegistered', async () => {
      mocks.sendPushNotificationsAsync.mockResolvedValue([
        okTicket(),
        errorTicket('DeviceNotRegistered'),
      ]);

      const result = await service.sendToMultipleTokens([TOKEN_1, TOKEN_2], TITLE, BODY);

      expect(result).toEqual([TOKEN_2]);
    });

    it('should NOT purge tokens that failed with a transient (non-DeviceNotRegistered) error', async () => {
      mocks.sendPushNotificationsAsync.mockResolvedValue([errorTicket('MessageRateExceeded')]);

      const result = await service.sendToMultipleTokens([TOKEN_1], TITLE, BODY);

      expect(result).toEqual([]);
    });

    it('should send each chunk returned by chunkPushNotifications', async () => {
      mocks.chunkPushNotifications.mockImplementation((m: unknown[]) => m.map((msg) => [msg]));
      mocks.sendPushNotificationsAsync.mockResolvedValue([okTicket()]);

      await service.sendToMultipleTokens([TOKEN_1, TOKEN_2], TITLE, BODY);

      expect(mocks.sendPushNotificationsAsync).toHaveBeenCalledTimes(2);
    });

    it('should return an empty array when the token list is empty', async () => {
      const result = await service.sendToMultipleTokens([], TITLE, BODY);

      expect(result).toEqual([]);
      expect(mocks.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should pass the data payload through to the message', async () => {
      mocks.sendPushNotificationsAsync.mockResolvedValue([okTicket()]);

      await service.sendToMultipleTokens([TOKEN_1], TITLE, BODY, { loanId: 'loan-42' });

      const sentMessages = mocks.sendPushNotificationsAsync.mock.calls[0][0];
      expect(sentMessages[0]).toEqual(expect.objectContaining({ data: { loanId: 'loan-42' } }));
    });

    it('should return an empty array (keep tokens) when sending throws', async () => {
      mocks.sendPushNotificationsAsync.mockRejectedValue(new Error('Network error'));

      const result = await service.sendToMultipleTokens([TOKEN_1], TITLE, BODY);

      expect(result).toEqual([]);
    });

    it('should report all tokens as invalid when none has a valid Expo format', async () => {
      const result = await service.sendToMultipleTokens([MALFORMED], TITLE, BODY);

      expect(result).toEqual([MALFORMED]);
      expect(mocks.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });
  });
});
