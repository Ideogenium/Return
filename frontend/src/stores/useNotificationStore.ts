import { create } from 'zustand';
import apiClient from '../api/apiClient';
import { extractProblemDetails } from '../utils/error';
import type { Notification, PaginatedResponse, ProblemDetails } from '../types/api.types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: ProblemDetails | null;
  /** Push token registered for this phone, kept so the logout can unregister it. */
  deviceToken: string | null;

  fetchNotifications: (options?: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  registerDeviceToken: (token: string, platform: 'ios' | 'android' | 'web') => Promise<void>;
  unregisterDeviceToken: (token: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  notifications: [] as Notification[],
  unreadCount: 0,
  isLoading: false,
  error: null as ProblemDetails | null,
  deviceToken: null as string | null,
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  ...initialState,

  fetchNotifications: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, unknown> = {};
      if (options?.unreadOnly) params.unreadOnly = true;
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;

      const { data } = await apiClient.get<PaginatedResponse<Notification>>('/notifications', {
        params,
      });
      const notifications = data.data;
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  markAsRead: async (id) => {
    // Capture whether we actually decremented
    const wasUnread = !!get().notifications.find((n) => n.id === id && !n.isRead);

    // Optimistic update
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      return {
        notifications: updated,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (err) {
      // Revert on failure — only increment if we actually decremented
      set((state) => {
        const reverted = state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: false } : n,
        );
        return {
          notifications: reverted,
          unreadCount: wasUnread ? state.unreadCount + 1 : state.unreadCount,
          error: extractProblemDetails(err),
        };
      });
      throw err;
    }
  },

  markAllAsRead: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await apiClient.get<PaginatedResponse<Notification>>('/notifications', {
        params: { unreadOnly: true, limit: 1 },
      });
      set({ unreadCount: data.pagination.totalItems });
    } catch {
      // Silent fail — badge update is non-critical
    }
  },

  registerDeviceToken: async (token, platform) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/notifications/device-token', { token, platform });
      set({ isLoading: false, deviceToken: token });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  unregisterDeviceToken: async (token) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete('/notifications/device-token', { data: { token } });
      set({ isLoading: false, deviceToken: null });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  reset: () => set({ ...initialState }),
}));
