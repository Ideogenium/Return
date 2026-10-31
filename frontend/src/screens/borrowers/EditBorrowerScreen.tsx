import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BorrowerForm } from '../../components/borrowers/BorrowerForm';
import { useBorrowerStore } from '../../stores/useBorrowerStore';
import { RefreshError } from '../../components/common/RefreshError';
import { useEntityLoad } from '../../hooks/useEntityLoad';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import type { BorrowerStackParamList } from '../../navigation/types';
import type { UpdateBorrowerDto } from '../../types/api.types';
import type { AxiosError } from 'axios';
import { FormScrollView } from '../../components/common/FormScrollView';

type Props = NativeStackScreenProps<BorrowerStackParamList, 'EditBorrower'>;

export function EditBorrowerScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { selectedBorrower, fetchBorrower } = useBorrowerStore();
  const { loadError, reload } = useEntityLoad(id, fetchBorrower);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  // Full-screen states only while nothing is displayable for this id: saving keeps the
  // form mounted, with what the user typed.
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

  const handleSubmit = async (data: UpdateBorrowerDto) => {
    setIsLoading(true);
    setApiError(undefined);
    try {
      await useBorrowerStore.getState().updateBorrower(id, data);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormScrollView contentContainerStyle={styles.container} testID="edit-borrower">
      {loadError && <RefreshError problem={loadError} onRetry={reload} />}
      <BorrowerForm
        mode="edit"
        defaultValues={{
          firstName: selectedBorrower.firstName,
          lastName: selectedBorrower.lastName,
          email: selectedBorrower.email,
          phoneNumber: selectedBorrower.phoneNumber ?? '',
        }}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={apiError}
        submitLabel={t('common.save')}
      />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#6B7A8D', textAlign: 'center', marginBottom: 16 },
  backButton: { borderRadius: 12 },
});
