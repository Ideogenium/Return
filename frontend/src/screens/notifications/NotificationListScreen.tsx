import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Icon,
  Text,
  SegmentedButtons,
  Button,
  Snackbar,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NotificationCard } from '../../components/notifications/NotificationCard';
import { loanDetailTabsParams } from '../../navigation/navigationRef';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { getErrorMessage } from '../../utils/error';
import type { Notification } from '../../types/api.types';

export function NotificationListScreen() {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications({ unreadOnly: filter === 'unread' }).catch(() => {
        setSnackbarVisible(true);
      });
    }, [fetchNotifications, filter]),
  );

  const handlePress = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id).catch(() => {});
    }
    if (notification.relatedLoanId) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Tabs',
          params: loanDetailTabsParams(notification.relatedLoanId),
        }),
      );
    }
  };

  const handleMarkRead = (id: string) => {
    markAsRead(id).catch(() => {
      setSnackbarVisible(true);
    });
  };

  const handleMarkAllRead = () => {
    markAllAsRead().catch(() => {
      setSnackbarVisible(true);
    });
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="notification-list">
      <View style={styles.header}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as 'all' | 'unread')}
          buttons={[
            { value: 'all', label: t('notifications.all') },
            { value: 'unread', label: t('notifications.unread') },
          ]}
          style={styles.segmentedButtons}
        />
        {unreadCount > 0 && (
          <Button
            mode="text"
            compact
            onPress={handleMarkAllRead}
            testID="mark-all-read-btn"
            style={styles.markAllBtn}
          >
            {t('notifications.markAllRead')}
          </Button>
        )}
      </View>

      <FlatList<Notification>
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NotificationCard notification={item} onPress={handlePress} onMarkRead={handleMarkRead} />
        )}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshing={isLoading}
        onRefresh={() =>
          fetchNotifications({ unreadOnly: filter === 'unread' }).catch(() => {
            setSnackbarVisible(true);
          })
        }
        ListEmptyComponent={
          <View style={styles.emptyState} testID="notification-empty">
            <Icon source="bell-off-outline" size={64} color="#C9C4BB" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {t('notifications.emptyList')}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {t('notifications.emptyListSubtitle')}
            </Text>
          </View>
        }
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}
      >
        {error ? getErrorMessage(error, t) : t('common.error')}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  segmentedButtons: { marginBottom: 8 },
  markAllBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  listContent: { paddingTop: 8, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#2D3748', fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#6B7A8D', marginTop: 8, textAlign: 'center' },
});
