import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useAuthStore } from '../useAuthStore';
import { useBorrowerStore } from '../useBorrowerStore';
import { useContactInvitationStore } from '../useContactInvitationStore';
import { useHistoryStore } from '../useHistoryStore';
import { useItemStore } from '../useItemStore';
import { useLoanStore } from '../useLoanStore';
import { useNotificationStore } from '../useNotificationStore';
import { useReminderStore } from '../useReminderStore';
import apiClient, { UPLOAD_TIMEOUT_MS } from '../../api/apiClient';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../../utils/storage';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(async () => {
  server.resetHandlers();
  await clearTokens();
  useAuthStore.getState().reset();
});
afterAll(() => server.close());

// Marks every user-data store with the previous account's data
function fillSessionStores() {
  useLoanStore.setState({ loans: [{ id: 'l1' }] as never, selectedLoan: { id: 'l1' } as never });
  useHistoryStore.setState({ loans: [{ id: 'h1' }] as never });
  useReminderStore.setState({ loanId: 'l1', reminders: [{ id: 'r1' }] as never });
  useBorrowerStore.setState({ borrowers: [{ id: 'b1' }] as never });
  useItemStore.setState({ items: [{ id: 'i1' }] as never });
  useContactInvitationStore.setState({
    receivedInvitations: [{ id: 'c1' }] as never,
    pendingCount: 2,
  });
  useNotificationStore.setState({ notifications: [{ id: 'n1' }] as never, unreadCount: 3 });
}

function expectSessionStoresEmpty() {
  expect(useLoanStore.getState().loans).toEqual([]);
  expect(useLoanStore.getState().selectedLoan).toBeNull();
  expect(useHistoryStore.getState().loans).toEqual([]);
  expect(useReminderStore.getState().reminders).toEqual([]);
  expect(useReminderStore.getState().loanId).toBeNull();
  expect(useBorrowerStore.getState().borrowers).toEqual([]);
  expect(useItemStore.getState().items).toEqual([]);
  expect(useContactInvitationStore.getState().receivedInvitations).toEqual([]);
  expect(useContactInvitationStore.getState().pendingCount).toBe(0);
  expect(useNotificationStore.getState().notifications).toEqual([]);
  expect(useNotificationStore.getState().unreadCount).toBe(0);
}

describe('useAuthStore', () => {
  describe('session data reset', () => {
    it('empties every user-data store on logout', async () => {
      fillSessionStores();
      await useAuthStore.getState().logout();
      expectSessionStoresEmpty();
    });

    it('empties every user-data store when the token refresh fails', async () => {
      await setRefreshToken('expired');
      server.use(http.post(`${API_BASE}/auth/refresh`, () => HttpResponse.error()));
      fillSessionStores();
      await useAuthStore.getState().refreshToken();
      expectSessionStoresEmpty();
    });

    it('empties every user-data store when there is no refresh token', async () => {
      fillSessionStores();
      await useAuthStore.getState().refreshToken();
      expectSessionStoresEmpty();
    });

    it('empties every user-data store when the session restore fails', async () => {
      await setAccessToken('invalid-token');
      server.use(http.get(`${API_BASE}/users/me`, () => HttpResponse.error()));
      fillSessionStores();
      await useAuthStore.getState().hydrate();
      expectSessionStoresEmpty();
    });
  });

  describe('login', () => {
    it('should set user and tokens on successful login', async () => {
      await useAuthStore.getState().login('test@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.role).toBe('LENDER');
      expect(state.accessToken).toBe('mock-access-token');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      expect(await getAccessToken()).toBe('mock-access-token');
      expect(await getRefreshToken()).toBe('mock-refresh-token');
    });

    it('should set error on 401', async () => {
      server.use(
        http.post(`${API_BASE}/auth/login`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/invalid-credentials',
              title: 'Invalid Credentials',
              status: 401,
              detail: 'Invalid email or password.',
              instance: '/v1/auth/login',
              timestamp: '2026-02-18T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 401 },
          );
        }),
      );

      await expect(useAuthStore.getState().login('wrong@example.com', 'wrong')).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).not.toBeNull();
      expect(state.error?.status).toBe(401);
    });
  });

  describe('register', () => {
    it('should set user and tokens on successful register', async () => {
      await useAuthStore.getState().register('new@example.com', 'P@ssw0rd!', 'Jane', 'Doe');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('new@example.com');
      expect(state.user?.firstName).toBe('Jane');
      expect(state.user?.role).toBe('LENDER');
      expect(state.isLoading).toBe(false);

      expect(await getAccessToken()).toBe('mock-access-token');
    });

    it('should set error on 409 (email already exists)', async () => {
      server.use(
        http.post(`${API_BASE}/auth/register`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/email-already-exists',
              title: 'Email Already Exists',
              status: 409,
              detail: 'An account with this email already exists.',
              instance: '/v1/auth/register',
              timestamp: '2026-02-18T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 409 },
          );
        }),
      );

      await expect(
        useAuthStore.getState().register('taken@example.com', 'P@ssw0rd!', 'Jane', 'Doe'),
      ).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error?.status).toBe(409);
    });
  });

  describe('logout', () => {
    it('should clear state and tokens', async () => {
      // D'abord se connecter
      await useAuthStore.getState().login('test@example.com', 'password');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();

      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should update tokens and user on successful refresh', async () => {
      await setRefreshToken('valid-refresh-token');

      await useAuthStore.getState().refreshToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.accessToken).toBe('mock-new-access-token');

      expect(await getAccessToken()).toBe('mock-new-access-token');
      expect(await getRefreshToken()).toBe('mock-new-refresh-token');
    });

    it('should reset state if no refresh token available', async () => {
      await useAuthStore.getState().refreshToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('isHydrating (session restore) vs isLoading (user actions)', () => {
    it('flags only the session restore as hydrating', async () => {
      await setAccessToken('stored-access-token');
      const pending = useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().isHydrating).toBe(true);
      await pending;
      expect(useAuthStore.getState().isHydrating).toBe(false);
    });

    it('never flags a registration as hydrating, so the navigation is not torn down', async () => {
      const pending = useAuthStore
        .getState()
        .register('new@example.com', 'Retour2026!', 'Jo', 'Do');

      expect(useAuthStore.getState().isLoading).toBe(true);
      expect(useAuthStore.getState().isHydrating).toBe(false);
      await pending.catch(() => {});
      expect(useAuthStore.getState().isHydrating).toBe(false);
    });

    it('never flags a login as hydrating', async () => {
      const pending = useAuthStore.getState().login('test@example.com', 'password');

      expect(useAuthStore.getState().isHydrating).toBe(false);
      await pending.catch(() => {});
    });
  });

  describe('app start and profile refresh', () => {
    it('starts on the splash screen (hydrating) until the stored session is restored', () => {
      jest.isolateModules(() => {
        const { useAuthStore: freshStore } = require('../useAuthStore');
        expect(freshStore.getState().isHydrating).toBe(true);
      });
    });

    it('never stays on the splash screen after a logout reset', () => {
      useAuthStore.setState({ isHydrating: true });

      useAuthStore.getState().reset();

      expect(useAuthStore.getState().isHydrating).toBe(false);
    });

    it('refreshes the profile without flagging the session restore', async () => {
      await setAccessToken('stored-access-token');
      const pending = useAuthStore.getState().refreshUser();

      expect(useAuthStore.getState().isHydrating).toBe(false);
      await pending;
      expect(useAuthStore.getState().user?.email).toBe('test@example.com');
      expect(useAuthStore.getState().isHydrating).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the last auth error, so it does not follow the user to another screen', async () => {
      useAuthStore.setState({
        error: {
          type: 'https://api.return.app/errors/validation-failed',
          title: 'Validation Failed',
          status: 400,
          detail: 'The request contains invalid data.',
          instance: '/v1/auth/register',
          timestamp: '2026-10-28T10:00:00Z',
          requestId: 'req-mock',
        },
      });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('hydrate', () => {
    it('should restore session from stored token', async () => {
      await setAccessToken('stored-access-token');

      await useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('test@example.com');
      expect(state.isLoading).toBe(false);
    });

    it('should remain unauthenticated if no stored token', async () => {
      await useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should clear tokens if /users/me fails', async () => {
      await setAccessToken('invalid-token');

      server.use(
        http.get(`${API_BASE}/users/me`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/unauthorized',
              title: 'Unauthorized',
              status: 401,
              detail: 'Token expired.',
              instance: '/v1/users/me',
              timestamp: '2026-02-18T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 401 },
          );
        }),
      );

      await useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(await getAccessToken()).toBeNull();
    });
  });

  describe('updateAvatar', () => {
    it('gives the upload the photo timeout, not the default one', async () => {
      const put = jest.spyOn(apiClient, 'put');

      await useAuthStore.getState().updateAvatar(new FormData());

      expect(put.mock.calls[0]?.[2]).toEqual(
        expect.objectContaining({ timeout: UPLOAD_TIMEOUT_MS }),
      );
      put.mockRestore();
    });
  });
});
