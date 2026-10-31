import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon, IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import { formatDate } from '../../utils/date';
import type { Notification, NotificationType } from '../../types/api.types';

const ICON_MAP: Record<NotificationType, string> = {
  LOAN_CREATED: 'handshake-outline',
  LOAN_CONFIRMED: 'check-circle-outline',
  LOAN_AUTO_CONFIRMED: 'check-all',
  LOAN_CONTESTED: 'alert-circle-outline',
  LOAN_RETURNED: 'check-all',
  REMINDER_SENT: 'bell-ring-outline',
  REMINDER_RECEIVED: 'bell-ring-outline',
};

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onMarkRead?: (id: string) => void;
}

function formatRelativeDate(
  dateStr: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return t('notifications.timeNow');
  if (diffMin < 60) return t('notifications.timeMinutes', { count: diffMin });
  if (diffHours < 24) return t('notifications.timeHours', { count: diffHours });
  if (diffDays < 7) return t('notifications.timeDays', { count: diffDays });
  return formatDate(date, language);
}

export function NotificationCard({ notification, onPress, onMarkRead }: NotificationCardProps) {
  const { t, i18n } = useTranslation();
  const icon = ICON_MAP[notification.type] ?? 'bell-outline';

  return (
    <TouchableRipple
      onPress={() => onPress(notification)}
      testID={`notification-card-${notification.id}`}
      style={[styles.card, ui.card, !notification.isRead && styles.unreadCard]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, !notification.isRead && styles.unreadIcon]}>
          <Icon source={icon} size={24} color={notification.isRead ? '#6B7A8D' : '#4A6355'} />
        </View>

        <View style={styles.info}>
          <Text
            variant="titleSmall"
            style={[styles.title, !notification.isRead && styles.unreadTitle]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text variant="bodySmall" style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
          <Text variant="labelSmall" style={styles.date}>
            {formatRelativeDate(notification.createdAt, t, i18n.language)}
          </Text>
        </View>

        {!notification.isRead && onMarkRead && (
          <IconButton
            icon="check"
            size={18}
            onPress={() => onMarkRead(notification.id)}
            testID={`mark-read-${notification.id}`}
            style={styles.markReadBtn}
          />
        )}
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginHorizontal: 16, marginBottom: 8 },
  unreadCard: { backgroundColor: '#F0F7F3' },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unreadIcon: { backgroundColor: '#D0E4DB' },
  info: { flex: 1 },
  title: { color: '#2D3748' },
  unreadTitle: { fontWeight: '700' },
  body: { color: '#6B7A8D', marginTop: 2 },
  date: { color: '#A8B5BF', marginTop: 4 },
  markReadBtn: { marginLeft: 4 },
});
