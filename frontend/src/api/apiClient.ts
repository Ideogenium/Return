import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getBaseUrl } from '../config/api-modules.config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../utils/storage';

// File de requêtes en attente pendant le refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error || !token) {
      promise.reject(error ?? new Error('No token available'));
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Photo uploads send up to 5 MB from the phone, then the API stores the file (at most
 * 26 s on its side): the default 15 s would give up on uploads that are still working.
 */
export const UPLOAD_TIMEOUT_MS = 60_000;

const apiClient = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur REQUEST : ajoute le Bearer token et résout la base URL
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Résoudre la base URL selon le module
  if (config.url && !config.url.startsWith('http')) {
    config.baseURL = getBaseUrl(config.url);
  }

  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur RESPONSE : refresh automatique sur 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Si 401 et pas déjà en retry, tenter un refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Un refresh est déjà en cours, mettre la requête en file d'attente
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          await clearTokens();
          return Promise.reject(error);
        }

        const baseUrl = getBaseUrl('/auth/refresh');
        const response = await axios.post(`${baseUrl}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        await setAccessToken(newAccessToken);
        await setRefreshToken(newRefreshToken);

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
