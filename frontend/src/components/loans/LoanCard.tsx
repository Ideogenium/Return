import { View, Image, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/date';
import { ui } from '../../config/theme.config';
import { StatusBadge } from './StatusBadge';
import { useAuthStore } from '../../stores/useAuthStore';
import { getContactForUser } from '../../utils/loan';
import type { Loan } from '../../types/api.types';

interface LoanCardProps {
  loan: Loan;
  onPress: (id: string) => void;
}

export function LoanCard({ loan, onPress }: LoanCardProps) {
  const { t, i18n } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const contact = getContactForUser(loan, currentUserId);
  const hasPhoto = loan.item.photos && loan.item.photos.length > 0;
  const isMoney = loan.item.category === 'MONEY';

  return (
    <TouchableRipple
      onPress={() => onPress(loan.id)}
      testID={`loan-card-${loan.id}`}
      style={[styles.card, ui.card]}
    >
      <View style={styles.content}>
        {isMoney ? (
          <View style={styles.iconContainer}>
            <Icon source="cash-multiple" size={28} color="#4A6355" />
          </View>
        ) : hasPhoto ? (
          <Image
            source={{ uri: loan.item.photos![0]!.thumbnailUrl ?? loan.item.photos![0]!.url }}
            style={styles.thumbnail}
            testID={`loan-photo-${loan.id}`}
          />
        ) : (
          <View style={styles.iconContainer}>
            <Icon source="package-variant-closed" size={28} color="#4A6355" />
          </View>
        )}

        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
            {loan.item.name}
          </Text>
          <Text variant="bodyMedium" style={styles.borrower} numberOfLines={1}>
            {t('navigation.contacts')}: {contact.firstName} {contact.lastName}
          </Text>
          <View style={styles.bottom}>
            <StatusBadge status={loan.status} size="small" />
            {loan.returnDate && (
              <Text variant="bodySmall" style={styles.date}>
                {formatDate(loan.returnDate, i18n.language)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginHorizontal: 16, marginBottom: 8 },
  content: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#D0E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  info: { flex: 1 },
  name: { color: '#2D3748', fontWeight: '600' },
  borrower: { color: '#6B7A8D', marginTop: 2 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  date: { color: '#A8B5BF' },
});
