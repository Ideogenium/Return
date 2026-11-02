import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { Borrower } from '../../types/api.types';
import { getContactEmailLine } from '../../utils/loan';

interface BorrowerCardProps {
  borrower: Borrower;
  onPress: (id: string) => void;
}

export function BorrowerCard({ borrower, onPress }: BorrowerCardProps) {
  const { t } = useTranslation();
  const initials = `${borrower.firstName[0]}${borrower.lastName[0]}`.toUpperCase();

  return (
    <TouchableRipple
      onPress={() => onPress(borrower.id)}
      testID={`borrower-card-${borrower.id}`}
      style={[styles.card, ui.card]}
    >
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text variant="titleMedium" style={styles.initials}>
            {initials}
          </Text>
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.name} testID={`borrower-name-${borrower.id}`}>
            {borrower.firstName} {borrower.lastName}
          </Text>
          <Text variant="bodyMedium" style={styles.email} testID={`borrower-email-${borrower.id}`}>
            {getContactEmailLine(borrower, t)}
          </Text>
          {borrower.phoneNumber && (
            <Text variant="bodySmall" style={styles.phone}>
              {borrower.phoneNumber}
            </Text>
          )}
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginHorizontal: 16, marginBottom: 8 },
  content: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D0E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  initials: { color: '#4A6355', fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#2D3748', fontWeight: '600' },
  email: { color: '#6B7A8D', marginTop: 2 },
  phone: { color: '#A8B5BF', marginTop: 2 },
});
