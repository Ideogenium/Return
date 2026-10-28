import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Icon, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoanCard } from '../../components/loans/LoanCard';
import { useHistoryStore } from '../../stores/useHistoryStore';
import type { ProfileStackParamList } from '../../navigation/types';
import type { HistoryLoanStatus, Loan } from '../../types/api.types';

// Terminal statuses accepted by GET /history/loans
const FILTER_STATUSES: { status: HistoryLoanStatus; label: string }[] = [
  { status: 'RETURNED', label: 'loans.statusReturned' },
  { status: 'NOT_RETURNED', label: 'loans.statusNotReturned' },
  { status: 'CONTESTED', label: 'loans.statusContested' },
  { status: 'ABANDONED', label: 'loans.statusAbandoned' },
];

type Props = NativeStackScreenProps<ProfileStackParamList, 'LoanHistory'>;

export function HistoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const loans = useHistoryStore((s) => s.loans);
  const statusFilter = useHistoryStore((s) => s.statusFilter);
  const isLoadingLoans = useHistoryStore((s) => s.isLoadingLoans);
  const isLoadingMore = useHistoryStore((s) => s.isLoadingMore);
  const loansError = useHistoryStore((s) => s.loansError);

  // Fetch on mount only (not on focus): coming back from a loan detail keeps the list,
  // its filter and its scroll position.
  useEffect(() => {
    useHistoryStore
      .getState()
      .setStatusFilter(null)
      .catch(() => {});
  }, []);

  const handleFilter = (status: HistoryLoanStatus | null) => {
    if (status === statusFilter) return;
    useHistoryStore.getState().setStatusFilter(status);
  };

  const renderFilters = () => (
    <View style={styles.filters}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ status: null, label: 'history.filterAll' }, ...FILTER_STATUSES]}
        keyExtractor={(item) => item.status ?? 'ALL'}
        renderItem={({ item }) => {
          const selected = statusFilter === item.status;
          return (
            <Chip
              selected={selected}
              onPress={() => handleFilter(item.status)}
              style={[styles.chip, selected && styles.chipSelected]}
              textStyle={selected ? styles.chipTextSelected : undefined}
              testID={`history-filter-chip-${item.status ?? 'ALL'}`}
            >
              {t(item.label)}
            </Chip>
          );
        }}
        contentContainerStyle={styles.chipRow}
      />
    </View>
  );

  const renderBody = () => {
    if (isLoadingLoans) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6B8E7B" testID="history-loading" />
        </View>
      );
    }

    if (loansError && loans.length === 0) {
      return (
        <View style={styles.centerContainer} testID="history-error">
          <Icon source="alert-circle-outline" size={64} color="#D97A6B" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('errors.unknownError')}
          </Text>
          <Button
            mode="outlined"
            onPress={() => useHistoryStore.getState().fetchArchivedLoans()}
            style={styles.retryButton}
            testID="history-retry"
          >
            {t('common.retry')}
          </Button>
        </View>
      );
    }

    return (
      <FlatList<Loan>
        testID="history-list"
        data={loans}
        keyExtractor={(loan) => loan.id}
        renderItem={({ item }) => (
          <LoanCard loan={item} onPress={(id) => navigation.navigate('LoanDetail', { id })} />
        )}
        onEndReached={() => useHistoryStore.getState().fetchNextArchivedLoans()}
        onEndReachedThreshold={0.5}
        contentContainerStyle={loans.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState} testID="history-empty">
            <Icon source="history" size={64} color="#C9C4BB" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {statusFilter ? t('history.emptyFiltered') : t('history.empty')}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {statusFilter ? t('history.emptyFilteredSubtitle') : t('history.emptySubtitle')}
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              size="small"
              color="#6B8E7B"
              style={styles.footer}
              testID="history-load-more"
            />
          ) : loansError && loans.length > 0 ? (
            <View style={styles.footer} testID="history-more-error">
              <Text variant="bodyMedium" style={styles.emptySubtitle}>
                {t('history.loadMoreError')}
              </Text>
              <Button
                mode="text"
                onPress={() => useHistoryStore.getState().fetchNextArchivedLoans()}
                testID="history-more-retry"
              >
                {t('common.retry')}
              </Button>
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderFilters()}
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  filters: { paddingTop: 12, paddingBottom: 4 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { backgroundColor: '#EDE9E2' },
  chipSelected: { backgroundColor: '#D0E4DB' },
  chipTextSelected: { color: '#4A6355', fontWeight: '600' },
  listContent: { paddingTop: 12, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#2D3748', fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#6B7A8D', marginTop: 8, textAlign: 'center' },
  retryButton: { marginTop: 16 },
  footer: { paddingVertical: 16, alignItems: 'center' },
});
