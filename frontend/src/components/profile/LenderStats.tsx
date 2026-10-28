import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Icon, Divider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/apiClient';
import type { GlobalTrustScore } from '../../types/api.types';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { STATUS_COLORS } from '../../config/theme.config';

interface StatItem {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}

async function fetchGlobalTrustScore(): Promise<GlobalTrustScore | null> {
  try {
    const { data } = await apiClient.get<GlobalTrustScore>('/users/me/trust-score');
    return data;
  } catch {
    // Stats non critiques → l'appelant retombe sur des zéros.
    return null;
  }
}

export function LenderStats() {
  const { t } = useTranslation();
  const { statistics } = useHistoryStore();
  const overview = statistics?.overview;

  const [borrowerStats, setBorrowerStats] = useState<GlobalTrustScore | null>(null);

  useEffect(() => {
    fetchGlobalTrustScore()
      .then(setBorrowerStats)
      .catch(() => {});
  }, []);

  const lenderStatsData: StatItem[] = [
    {
      icon: 'handshake-outline',
      label: t('profile.totalLoans'),
      value: overview?.totalLoans ?? 0,
      color: '#4A6355',
    },
    {
      icon: 'clock-outline',
      label: t('profile.activeLoans'),
      value: overview?.activeLoans ?? 0,
      color: '#6B8E7B',
    },
    {
      icon: 'check-circle-outline',
      label: t('profile.returnedLoans'),
      value: overview?.returnedLoans ?? 0,
      color: '#7BAE8E',
    },
    {
      icon: 'comment-alert-outline',
      label: t('profile.contestedLoans'),
      value: overview?.contestedLoans ?? 0,
      color: '#C46A5D',
    },
    {
      icon: 'close-circle-outline',
      label: t('profile.notReturnedLoans'),
      value: overview?.notReturnedLoans ?? 0,
      color: '#D97A6B',
    },
    {
      icon: 'calendar-alert',
      label: t('profile.overdueLoans'),
      value: overview?.overdueLoans ?? 0,
      color: STATUS_COLORS.AWAITING_RETURN.light,
    },
  ];

  const borrowerStatsData: StatItem[] = [
    {
      icon: 'package-variant',
      label: t('profile.loansReceived'),
      value: borrowerStats?.totalLoans ?? 0,
      color: '#4A6355',
    },
    {
      icon: 'check-circle-outline',
      label: t('profile.returnedOnTime'),
      value: borrowerStats?.returnedOnTime ?? 0,
      color: '#7BAE8E',
    },
    {
      icon: 'clock-alert-outline',
      label: t('profile.returnedLate'),
      value: borrowerStats?.returnedLate ?? 0,
      color: '#D97A6B',
    },
    {
      icon: 'shield-check-outline',
      label: t('profile.trustScore'),
      value:
        borrowerStats?.trustScore == null ? t('profile.notRated') : `${borrowerStats.trustScore}%`,
      color: '#6B8E7B',
    },
  ];

  const renderStatRow = (stats: StatItem[]) => (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statItem}>
          <Icon source={stat.icon} size={24} color={stat.color} />
          <Text variant="headlineSmall" style={[styles.statValue, { color: stat.color }]}>
            {stat.value}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <Card style={styles.card} testID="lender-stats">
      <Card.Content>
        <Text variant="titleMedium" style={styles.title}>
          {t('profile.statistics')}
        </Text>

        <Text variant="labelLarge" style={styles.sectionLabel}>
          {t('loans.myLoans')}
        </Text>
        {renderStatRow(lenderStatsData)}

        <Divider style={styles.divider} />

        <Text variant="labelLarge" style={styles.sectionLabel}>
          {t('loans.myBorrowings')}
        </Text>
        {renderStatRow(borrowerStatsData)}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, backgroundColor: '#FFFFFF' },
  title: { color: '#2D3748', fontWeight: '700', marginBottom: 12 },
  sectionLabel: { color: '#4A6355', fontWeight: '600', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 16, justifyContent: 'center' },
  statItem: { alignItems: 'center', gap: 4, minWidth: '28%', flex: 1 },
  statValue: { fontWeight: '700' },
  statLabel: { color: '#6B7A8D', textAlign: 'center' },
  divider: { marginVertical: 12 },
});
