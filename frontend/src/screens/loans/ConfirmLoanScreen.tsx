import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmationDialog } from '../../components/loans/ConfirmationDialog';
import { useLoanStore } from '../../stores/useLoanStore';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import type { LoanStackParamList } from '../../navigation/types';
import type { AxiosError } from 'axios';

type Props = NativeStackScreenProps<LoanStackParamList, 'ConfirmLoan'>;

export function ConfirmLoanScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { selectedLoan, error, fetchLoan } = useLoanStore();
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  useEffect(() => {
    fetchLoan(id)
      .then(() => setDialogVisible(true))
      .catch(() => {});
  }, [id, fetchLoan]);

  const handleConfirm = async () => {
    setActionLoading(true);
    setApiError(undefined);
    try {
      await useLoanStore.getState().confirmLoan(id);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleContest = async (reason: string) => {
    setActionLoading(true);
    setApiError(undefined);
    try {
      await useLoanStore.getState().contestLoan(id, { reason });
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Full-screen states only while nothing is displayable for this id: actions and
  // refreshes keep the screen (and its open dialogs) mounted.
  if (!selectedLoan || selectedLoan.id !== id) {
    if (!error) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
        </View>
      );
    }
    return (
      <View style={styles.centerContainer} testID="loan-error">
        <Text variant="titleMedium" style={styles.errorText}>
          {error?.type?.includes('loan-not-found')
            ? t('errors.loanNotFound')
            : t('errors.unknownError')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
          {t('common.back')}
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="confirm-loan-screen">
      <ConfirmationDialog
        loan={selectedLoan}
        visible={dialogVisible}
        onDismiss={() => {
          setDialogVisible(false);
          navigation.goBack();
        }}
        onConfirm={handleConfirm}
        onContest={handleContest}
        isLoading={actionLoading}
        error={apiError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#6B7A8D', textAlign: 'center', marginBottom: 16 },
  backButton: { borderRadius: 12 },
});
