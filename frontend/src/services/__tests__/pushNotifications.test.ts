jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
  },
}));

const mockRegisterDeviceToken = jest.fn().mockResolvedValue(undefined);

jest.mock('../../stores/useNotificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      registerDeviceToken: mockRegisterDeviceToken,
    }),
  },
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, setupNotificationHandler } from '../pushNotifications';

const originalOS = Platform.OS;

afterEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
});

describe('pushNotifications', () => {
  describe('registerForPushNotifications', () => {
    describe('F1 — token retrieval and registration', () => {
      it('should call getExpoPushTokenAsync with the projectId from Constants', async () => {
        await registerForPushNotifications();

        expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
          projectId: 'test-project-id',
        });
      });

      it('should return the push token string', async () => {
        const token = await registerForPushNotifications();

        expect(token).toBe('ExponentPushToken[mock-token]');
      });

      it('should call registerDeviceToken with the token and the correct platform', async () => {
        Platform.OS = 'ios';

        await registerForPushNotifications();

        expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
          'ExponentPushToken[mock-token]',
          'ios',
        );
      });
    });

    describe('permissions denied', () => {
      beforeEach(() => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'denied',
        });
      });

      it('should return null when permissions are denied', async () => {
        const token = await registerForPushNotifications();

        expect(token).toBeNull();
      });

      it('should not call getExpoPushTokenAsync when permissions are denied', async () => {
        await registerForPushNotifications();

        expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      });

      it('should not call setNotificationChannelAsync when permissions are denied', async () => {
        await registerForPushNotifications();

        expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
      });

      it('should not call registerDeviceToken when permissions are denied', async () => {
        await registerForPushNotifications();

        expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
      });
    });

    describe('permission already granted', () => {
      it('should not call requestPermissionsAsync when permission is already granted', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

        await registerForPushNotifications();

        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });
    });

    describe('F3 — Android notification channel', () => {
      it('should call setNotificationChannelAsync with channel id "default" on Android', async () => {
        Platform.OS = 'android';

        await registerForPushNotifications();

        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          'default',
          expect.objectContaining({ importance: Notifications.AndroidImportance.MAX }),
        );
      });

      it('should call setNotificationChannelAsync with importance MAX (5) on Android', async () => {
        Platform.OS = 'android';

        await registerForPushNotifications();

        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          'default',
          expect.objectContaining({ importance: 5 }),
        );
      });

      it('should call setNotificationChannelAsync before getExpoPushTokenAsync on Android', async () => {
        Platform.OS = 'android';
        const callOrder: string[] = [];
        (Notifications.setNotificationChannelAsync as jest.Mock).mockImplementation(async () => {
          callOrder.push('setNotificationChannelAsync');
        });
        (Notifications.getExpoPushTokenAsync as jest.Mock).mockImplementation(async () => {
          callOrder.push('getExpoPushTokenAsync');
          return { data: 'ExponentPushToken[mock-token]' };
        });

        await registerForPushNotifications();

        expect(callOrder).toEqual(['setNotificationChannelAsync', 'getExpoPushTokenAsync']);
      });

      it('should call registerDeviceToken with platform "android" on Android', async () => {
        Platform.OS = 'android';

        await registerForPushNotifications();

        expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
          'ExponentPushToken[mock-token]',
          'android',
        );
      });
    });

    describe('F3 iOS — no regression', () => {
      it('should not call setNotificationChannelAsync on iOS', async () => {
        Platform.OS = 'ios';

        await registerForPushNotifications();

        expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
      });

      it('should call registerDeviceToken with platform "ios" on iOS', async () => {
        Platform.OS = 'ios';

        await registerForPushNotifications();

        expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
          'ExponentPushToken[mock-token]',
          'ios',
        );
      });
    });
  });

  describe('setupNotificationHandler', () => {
    it('should call setNotificationHandler exactly once', () => {
      setupNotificationHandler();

      expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    });

    it('should call setNotificationHandler with an object containing a handleNotification function', () => {
      setupNotificationHandler();

      expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        }),
      );
    });
  });
});
