import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChangePasswordForm } from '../../components/profile/ChangePasswordForm';
import apiClient from '../../api/apiClient';
import { parseProblemDetails, getErrorMessage, getFieldErrors } from '../../utils/error';
import type { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import type { ChangePasswordDto } from '../../types/api.types';

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  const handleSubmit = async (data: ChangePasswordDto) => {
    setIsLoading(true);
    setError(undefined);
    setFieldErrors(undefined);
    try {
      await apiClient.patch('/users/me/password', data);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      const fields = problem ? getFieldErrors(problem, t) : {};
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      } else {
        setError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ChangePasswordForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        fieldErrors={fieldErrors}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, justifyContent: 'center' },
});
