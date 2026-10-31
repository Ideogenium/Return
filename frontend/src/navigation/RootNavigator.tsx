import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '../config/i18n.config';
import { useAuthStore } from '../stores/useAuthStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { resetSessionStores } from '../stores/resetSessionStores';
import {
  registerForPushNotifications,
  setupNotificationHandler,
} from '../services/pushNotifications';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { navigateToLoanDetail } from './navigationRef';

export function RootNavigator() {
  const { isAuthenticated, isHydrating, user, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Synchronise i18n avec la langue sauvegardée côté serveur
  useEffect(() => {
    if (user?.settings?.language && user.settings.language !== i18n.language) {
      i18n.changeLanguage(user.settings.language);
    }
  }, [user?.settings?.language]);

  // Init / cleanup notifications on auth changes
  const deviceTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const store = useNotificationStore.getState();

    if (isAuthenticated) {
      setupNotificationHandler();
      registerForPushNotifications()
        .then((token) => {
          deviceTokenRef.current = token;
        })
        .catch(() => {});
      store.fetchNotifications().catch(() => {});
    } else {
      if (deviceTokenRef.current) {
        store.unregisterDeviceToken(deviceTokenRef.current).catch(() => {});
        deviceTokenRef.current = null;
      }
      // Same reset as logout/refresh failure; kept after the device-token call to preserve its order
      resetSessionStores();
    }
  }, [isAuthenticated]);

  // Deep-link to the relevant loan when a push notification is tapped
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const loanId = response.notification.request.content.data?.loanId as string | undefined;
      navigateToLoanDetail(loanId);
    });

    // Cold start: the app was opened from a killed state by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const loanId = response?.notification.request.content.data?.loanId as string | undefined;
      navigateToLoanDetail(loanId);
    });

    return () => subscription.remove();
  }, []);

  // Poll unread count every 30s to keep the badge up to date
  // Pause polling when app is in background to save battery
  useEffect(() => {
    if (!isAuthenticated) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (!interval) {
        interval = setInterval(() => {
          useNotificationStore.getState().fetchUnreadCount();
        }, 30_000);
      }
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    useNotificationStore.getState().fetchUnreadCount();
    start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useNotificationStore.getState().fetchUnreadCount();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [isAuthenticated]);

  // Only the session restore replaces the navigation: user actions (login, register,
  // avatar…) keep their screen mounted, with its form state and its error message.
  if (isHydrating) {
    return (
      <View style={styles.splash} testID="splash-screen">
        <ActivityIndicator size="large" color="#6B8E7B" />
      </View>
    );
  }

  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4EF',
  },
});
