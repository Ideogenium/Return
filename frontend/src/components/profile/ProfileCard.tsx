import { View, Image, StyleSheet } from 'react-native';
import { Text, Divider, Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import { formatDate } from '../../utils/date';
import type { User } from '../../types/api.types';

interface ProfileCardProps {
  user: User;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const { t, i18n } = useTranslation();

  return (
    <View style={[styles.card, ui.card]} testID="profile-card">
      <View style={styles.header}>
        {user.profilePicture ? (
          <Image
            source={{ uri: user.profilePicture }}
            style={styles.avatarImage}
            testID="profile-avatar-image"
          />
        ) : (
          <View style={styles.avatar} testID="profile-avatar-icon">
            <Icon source="account" size={32} color="#6B8E7B" />
          </View>
        )}
        <View style={styles.headerText}>
          <Text variant="headlineSmall" style={styles.name} testID="profile-name">
            {user.firstName} {user.lastName}
          </Text>
          <Text variant="bodyMedium" style={styles.email} testID="profile-email">
            {user.email}
          </Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Icon source="calendar-outline" size={16} color="#A8B5BF" />
          <Text variant="bodySmall" style={styles.label}>
            {t('profile.memberSince')}
          </Text>
        </View>
        <Text variant="bodyMedium" style={styles.value}>
          {formatDate(user.createdAt, i18n.language)}
        </Text>
      </View>

      {user.lastLoginAt && (
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Icon source="clock-outline" size={16} color="#A8B5BF" />
            <Text variant="bodySmall" style={styles.label}>
              {t('profile.lastLogin')}
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.value}>
            {formatDate(user.lastLoginAt, i18n.language)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D0E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#B3D4C4',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  headerText: { flex: 1 },
  name: { color: '#2D3748', fontWeight: '700' },
  email: { color: '#6B7A8D', marginTop: 2 },
  divider: { marginVertical: 16, backgroundColor: '#C9C4BB' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#6B7A8D' },
  value: { color: '#3D4F5C', fontWeight: '500' },
});
