// Force all requests to go through MSW (bypass Prism mock server)
jest.mock('../../config/api-modules.config', () => ({
  getBaseUrl: () => 'http://localhost:3000/v1',
}));

import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useNotificationStore } from '../useNotificationStore';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useNotificationStore.getState().reset();
});
afterAll(() => server.close());

describe('useNotificationStore', () => {
  describe('fetchNotifications', () => {
    it('should fetch all notifications and compute unreadCount', async () => {
      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.unreadCount).toBe(1);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should fetch unread-only notifications', async () => {
      await useNotificationStore.getState().fetchNotifications({ unreadOnly: true });

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]!.isRead).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should optimistically mark a notification as read', async () => {
      await useNotificationStore.getState().fetchNotifications();
      expect(useNotificationStore.getState().unreadCount).toBe(1);

      await useNotificationStore.getState().markAsRead('notif-unread-1234');

      const state = useNotificationStore.getState();
      const notif = state.notifications.find((n) => n.id === 'notif-unread-1234');
      expect(notif?.isRead).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should revert on API failure', async () => {
      await useNotificationStore.getState().fetchNotifications();

      server.use(
        http.patch(`${API_BASE}/notifications/:id/read`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Internal Server Error',
              status: 500,
              detail: 'An unexpected error occurred',
              instance: '/notifications/notif-unread-1234/read',
              timestamp: '2026-03-18T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          );
        }),
      );

      await expect(
        useNotificationStore.getState().markAsRead('notif-unread-1234'),
      ).rejects.toThrow();

      const state = useNotificationStore.getState();
      const notif = state.notifications.find((n) => n.id === 'notif-unread-1234');
      expect(notif?.isRead).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      await useNotificationStore.getState().fetchNotifications();
      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.unreadCount).toBe(0);
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('fetchUnreadCount', () => {
    it('should set unreadCount from pagination.totalItems', async () => {
      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should fail silently on error without changing state', async () => {
      // Set an initial unreadCount
      await useNotificationStore.getState().fetchNotifications();
      expect(useNotificationStore.getState().unreadCount).toBe(1);

      server.use(
        http.get(`${API_BASE}/notifications`, () => {
          return HttpResponse.json(
            { type: 'error', title: 'Error', status: 500, detail: 'fail' },
            { status: 500 },
          );
        }),
      );

      // Should not throw
      await useNotificationStore.getState().fetchUnreadCount();

      // unreadCount unchanged
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });

  describe('registerDeviceToken', () => {
    it('should register device token and call correct endpoint', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/notifications/device-token`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      await useNotificationStore.getState().registerDeviceToken('expo-token-123', 'android');

      expect(capturedBody).toEqual({ token: 'expo-token-123', platform: 'android' });
      expect(useNotificationStore.getState().isLoading).toBe(false);
      expect(useNotificationStore.getState().error).toBeNull();
    });

    it('keeps the device token once the registration succeeds', async () => {
      await useNotificationStore.getState().registerDeviceToken('expo-token-123', 'android');

      expect(useNotificationStore.getState().deviceToken).toBe('expo-token-123');
    });

    it('leaves the device token unchanged when the registration fails', async () => {
      useNotificationStore.setState({ deviceToken: 'previous-token' });
      server.use(
        http.post(`${API_BASE}/notifications/device-token`, () =>
          HttpResponse.json(
            { type: 'error', title: 'Error', status: 500, detail: 'fail' },
            { status: 500 },
          ),
        ),
      );

      await expect(
        useNotificationStore.getState().registerDeviceToken('expo-token-123', 'android'),
      ).rejects.toThrow();

      expect(useNotificationStore.getState().deviceToken).toBe('previous-token');
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister device token and call correct endpoint', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.delete(`${API_BASE}/notifications/device-token`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      await useNotificationStore.getState().unregisterDeviceToken('expo-token-123');

      expect(capturedBody).toEqual({ token: 'expo-token-123' });
      expect(useNotificationStore.getState().isLoading).toBe(false);
      expect(useNotificationStore.getState().error).toBeNull();
    });

    it('clears the device token once the unregistration succeeds', async () => {
      useNotificationStore.setState({ deviceToken: 'expo-token-123' });

      await useNotificationStore.getState().unregisterDeviceToken('expo-token-123');

      expect(useNotificationStore.getState().deviceToken).toBeNull();
    });

    it('keeps the device token when the unregistration fails', async () => {
      useNotificationStore.setState({ deviceToken: 'expo-token-123' });
      server.use(
        http.delete(`${API_BASE}/notifications/device-token`, () =>
          HttpResponse.json(
            { type: 'error', title: 'Error', status: 500, detail: 'fail' },
            { status: 500 },
          ),
        ),
      );

      await expect(
        useNotificationStore.getState().unregisterDeviceToken('expo-token-123'),
      ).rejects.toThrow();

      expect(useNotificationStore.getState().deviceToken).toBe('expo-token-123');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      await useNotificationStore.getState().fetchNotifications();
      expect(useNotificationStore.getState().notifications.length).toBeGreaterThan(0);

      useNotificationStore.getState().reset();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('starts with no device token and clears it on reset', () => {
      expect(useNotificationStore.getState().deviceToken).toBeNull();
      useNotificationStore.setState({ deviceToken: 'expo-token-123' });

      useNotificationStore.getState().reset();

      expect(useNotificationStore.getState().deviceToken).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error state on fetchNotifications failure', async () => {
      server.use(
        http.get(`${API_BASE}/notifications`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/internal-server-error',
              title: 'Internal Server Error',
              status: 500,
              detail: 'An unexpected error occurred',
              instance: '/notifications',
              timestamp: '2026-03-18T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          );
        }),
      );

      await expect(useNotificationStore.getState().fetchNotifications()).rejects.toThrow();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.error).not.toBeNull();
      expect(state.error?.status).toBe(500);
      expect(state.error?.detail).toBe('An unexpected error occurred');
      expect(state.isLoading).toBe(false);
    });
  });
});
