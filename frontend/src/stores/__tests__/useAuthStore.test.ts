import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useAuthStore } from '../useAuthStore';
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

describe('useAuthStore', () => {
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
      const pending = useAuthStore.getState().register('new@example.com', 'Retour2026!', 'Jo', 'Do');

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
});
