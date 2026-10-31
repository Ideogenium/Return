import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, Portal, Dialog, HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BorrowerStatsBadge } from '../../components/borrowers/BorrowerStatsBadge';
import { useBorrowerStore } from '../../stores/useBorrowerStore';
import { RefreshError } from '../../components/common/RefreshError';
import { useEntityLoad } from '../../hooks/useEntityLoad';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import { ui } from '../../config/theme.config';
import type { BorrowerStackParamList } from '../../navigation/types';
import type { AxiosError } from 'axios';

type Props = NativeStackScreenProps<BorrowerStackParamList, 'BorrowerDetail'>;

export function BorrowerDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { selectedBorrower, selectedBorrowerStats, fetchBorrower, fetchBorrowerStats } =
    useBorrowerStore();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  const { loadError, reload } = useEntityLoad(id, fetchBorrower);

  // Statistics are secondary: their failure only hides the stats section.
  useEffect(() => {
    fetchBorrowerStats(id).catch(() => {});
  }, [id, fetchBorrowerStats]);

  const handleDelete = async () => {
    setDeleteDialogVisible(false);
    setApiError(undefined);
    try {
      await useBorrowerStore.getState().deleteBorrower(id);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    }
  };

  // Full-screen states only while nothing is displayable for this id: actions and
  // refreshes keep the screen (and its open dialogs) mounted.
  if (!selectedBorrower || selectedBorrower.id !== id) {
    if (!loadError) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
        </View>
      );
    }
    return (
      <View style={styles.centerContainer} testID="borrower-error">
        <Text variant="titleMedium" style={styles.errorText}>
          {loadError.type?.includes('borrower-not-found')
            ? t('errors.borrowerNotFound')
            : t('errors.unknownError')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
          {t('common.back')}
        </Button>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} testID="borrower-detail">
      {loadError && <RefreshError problem={loadError} onRetry={reload} />}
      <View style={[styles.infoCard, ui.card]}>
        <View style={styles.avatar}>
          <Text variant="headlineMedium" style={styles.initials}>
            {selectedBorrower.firstName[0]}
            {selectedBorrower.lastName[0]}
          </Text>
        </View>
        <Text variant="headlineSmall" style={styles.name}>
          {selectedBorrower.firstName} {selectedBorrower.lastName}
        </Text>
        <Text variant="bodyMedium" style={styles.email}>
          {selectedBorrower.email}
        </Text>
        {selectedBorrower.phoneNumber && (
          <Text variant="bodyMedium" style={styles.phone}>
            {selectedBorrower.phoneNumber}
          </Text>
        )}
      </View>

      {selectedBorrowerStats && <BorrowerStatsBadge statistics={selectedBorrowerStats} />}

      {apiError && (
        <HelperText type="error" testID="api-error" style={styles.apiError}>
          {apiError}
        </HelperText>
      )}

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="pencil-outline"
          onPress={() => navigation.navigate('EditBorrower', { id })}
          style={styles.primaryButton}
          labelStyle={styles.buttonLabel}
          contentStyle={styles.buttonContent}
          testID="edit-borrower-btn"
        >
          {t('borrowers.editContact')}
        </Button>

        <Button
          mode="outlined"
          icon="trash-can-outline"
          onPress={() => setDeleteDialogVisible(true)}
          style={styles.dangerButton}
          textColor="#D97A6B"
          labelStyle={styles.buttonLabel}
          contentStyle={styles.buttonContent}
          testID="delete-borrower-btn"
        >
          {t('common.delete')}
        </Button>
      </View>

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          testID="confirm-delete-dialog"
        >
          <Dialog.Title>{t('borrowers.confirmDelete')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('borrowers.deleteWarning')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} testID="cancel-delete-btn">
              {t('common.cancel')}
            </Button>
            <Button onPress={handleDelete} textColor="#D97A6B" testID="confirm-delete-btn">
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#6B7A8D', textAlign: 'center', marginBottom: 16 },
  backButton: { borderRadius: 12 },
  infoCard: { margin: 16, padding: 24, alignItems: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D0E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  initials: { color: '#4A6355', fontWeight: '700' },
  name: { color: '#2D3748', fontWeight: '700', marginBottom: 4 },
  email: { color: '#6B7A8D' },
  phone: { color: '#A8B5BF', marginTop: 4 },
  apiError: { marginHorizontal: 16 },
  actions: { paddingHorizontal: 16, gap: 10, marginTop: 8 },
  primaryButton: { borderRadius: 12 },
  dangerButton: { borderRadius: 12, borderColor: '#FAEAE7' },
  buttonLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 6 },
});
