import { create } from 'zustand';
import apiClient, { UPLOAD_TIMEOUT_MS } from '../api/apiClient';
import {
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from '../utils/storage';
import { resetSessionStores } from './resetSessionStores';
import { extractProblemDetails } from '../utils/error';
import type { User, AuthResponse, ProblemDetails } from '../types/api.types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** A user action (login, register, avatar…) is in flight. Never tears down navigation. */
  isLoading: boolean;
  /** The stored session is being restored at app start: the only global loading state. */
  isHydrating: boolean;
  error: ProblemDetails | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Reloads the signed-in user's profile without the app-wide splash screen. */
  refreshUser: () => Promise<void>;
  updateAvatar: (formData: FormData) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrating: false,
  error: null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  // The app starts on the splash screen until hydrate() restores the stored session;
  // reset() (logout) goes back to initialState, which is not hydrating.
  isHydrating: true,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  register: async (email, password, firstName, lastName) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', {
        email,
        password,
        firstName,
        lastName,
      });
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // On déconnecte même si l'appel échoue (token expiré, réseau, etc.)
    }
    await clearTokens();
    resetSessionStores();
    set({ ...initialState });
  },

  refreshToken: async () => {
    const currentRefreshToken = await getRefreshToken();
    if (!currentRefreshToken) {
      await clearTokens();
      resetSessionStores();
      set({ ...initialState });
      return;
    }

    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        isAuthenticated: true,
      });
    } catch {
      await clearTokens();
      resetSessionStores();
      set({ ...initialState });
    }
  },

  refreshUser: async () => {
    try {
      const { data: user } = await apiClient.get<User>('/users/me');
      set({ user });
    } catch (err) {
      set({ error: extractProblemDetails(err) });
      throw err;
    }
  },

  hydrate: async () => {
    set({ isHydrating: true });
    const token = await getAccessToken();
    if (!token) {
      set({ isHydrating: false });
      return;
    }

    try {
      const { data: user } = await apiClient.get<User>('/users/me');
      set({
        user,
        accessToken: token,
        isAuthenticated: true,
        isHydrating: false,
      });
    } catch {
      await clearTokens();
      resetSessionStores();
      set({ ...initialState });
    }
  },

  updateAvatar: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.put<{ profilePicture: string }>(
        '/users/me/avatar',
        formData,
        {
          headers: { 'Content-Type': undefined },
          timeout: UPLOAD_TIMEOUT_MS,
        },
      );
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        set({ user: { ...currentUser, profilePicture: data.profilePicture }, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  deleteAvatar: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete('/users/me/avatar');
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        set({ user: { ...currentUser, profilePicture: null }, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ ...initialState }),
}));
