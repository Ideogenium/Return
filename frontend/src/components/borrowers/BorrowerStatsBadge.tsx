import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { BorrowerStatistics } from '../../types/api.types';

interface BorrowerStatsBadgeProps {
  statistics: BorrowerStatistics;
}

function getTrustScoreColor(score: number | null): string {
  if (score === null) return '#C9C4BB'; // Neutral — pas encore noté
  if (score >= 75) return '#6B8E7B'; // Sage
  if (score >= 50) return '#C9C4BB'; // Neutral
  return '#D97A6B'; // Terracotta
}

export function BorrowerStatsBadge({ statistics }: BorrowerStatsBadgeProps) {
  const { t } = useTranslation();
  const scoreColor = getTrustScoreColor(statistics.trustScore);

  return (
    <View style={[styles.card, ui.card]} testID="stats-badge">
      <Text variant="titleMedium" style={styles.title}>
        {t('borrowers.statistics')}
      </Text>

      <View style={styles.scoreRow}>
        <Text variant="bodyMedium" style={styles.label}>
          {t('borrowers.trustScore')}
        </Text>
        <Text
          variant="titleLarge"
          style={[styles.score, { color: scoreColor }]}
          testID="trust-score"
        >
          {statistics.trustScore === null ? t('borrowers.notRated') : `${statistics.trustScore}%`}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text variant="titleMedium" style={styles.statValue} testID="total-loans">
            {statistics.totalLoans}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('borrowers.totalLoans')}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="titleMedium" style={[styles.statValue, styles.statOnTime]}>
            {statistics.returnedOnTime}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('borrowers.returnedOnTime')}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="titleMedium" style={[styles.statValue, styles.statLate]}>
            {statistics.returnedLate}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('borrowers.returnedLate')}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text variant="titleMedium" style={[styles.statValue, styles.statNotReturned]}>
            {statistics.notReturned}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('borrowers.notReturned')}
          </Text>
        </View>
      </View>

      {statistics.averageReturnDelay !== null && (
        <View style={styles.delayRow}>
          <Text variant="bodyMedium" style={styles.label}>
            {t('borrowers.averageDelay')}
          </Text>
          <Text variant="bodyMedium" style={styles.delayValue}>
            {statistics.averageReturnDelay} {t('borrowers.days')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 20 },
  title: { color: '#2D3748', fontWeight: '700', marginBottom: 16 },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { color: '#6B7A8D' },
  score: { fontWeight: '800' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: '#F7F4EF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontWeight: '700', color: '#2D3748' },
  statOnTime: { color: '#6B8E7B' },
  statLate: { color: '#C9C4BB' },
  statNotReturned: { color: '#D97A6B' },
  statLabel: { color: '#6B7A8D', marginTop: 4, textAlign: 'center' },
  delayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE9E2',
  },
  delayValue: { color: '#3D4F5C', fontWeight: '500' },
});
