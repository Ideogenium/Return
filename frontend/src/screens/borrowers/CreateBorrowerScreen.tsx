import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BorrowerForm } from '../../components/borrowers/BorrowerForm';
import { useBorrowerStore } from '../../stores/useBorrowerStore';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import type { BorrowerStackParamList } from '../../navigation/types';
import type { CreateBorrowerDto } from '../../types/api.types';
import type { AxiosError } from 'axios';
import { FormScrollView } from '../../components/common/FormScrollView';

type Props = NativeStackScreenProps<BorrowerStackParamList, 'CreateBorrower'>;

export function CreateBorrowerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  const handleSubmit = async (data: CreateBorrowerDto) => {
    setIsLoading(true);
    setApiError(undefined);
    try {
      await useBorrowerStore.getState().createBorrower(data);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormScrollView contentContainerStyle={styles.container}>
      <BorrowerForm
        mode="create"
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={apiError}
        submitLabel={t('borrowers.addContact')}
      />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
});
