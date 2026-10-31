import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, Button, HelperText, Icon } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import { ui } from '../../config/theme.config';
import type { AxiosError } from 'axios';
import { FormScrollView } from '../../components/common/FormScrollView';

interface DeleteFormData {
  password: string;
  confirmationText: string;
}

export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  const {
    control,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<DeleteFormData>();

  const handleDelete = async (data: DeleteFormData) => {
    setIsLoading(true);
    setApiError(undefined);
    try {
      await apiClient.delete('/users/me', {
        data: { password: data.password, confirmationText: data.confirmationText },
      });
      await logout();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormScrollView contentContainerStyle={styles.container}>
      <View style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Icon source="alert-circle-outline" size={22} color="#D97A6B" />
          <Text variant="titleMedium" style={styles.warningTitle}>
            {t('profile.confirmDelete')}
          </Text>
        </View>
        <Text variant="bodyMedium" style={styles.warningText}>
          {t('profile.deleteWarning')}
        </Text>
      </View>

      <Controller
        control={control}
        name="password"
        // Verification of the current password: only required, as in the API (DeleteAccountDto).
        rules={{ required: t('auth.passwordRequired') }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <TextInput
            label={t('auth.password')}
            mode="outlined"
            secureTextEntry
            left={<TextInput.Icon icon="lock-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.password}
            ref={ref}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => setFocus('confirmationText')}
            testID="password-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.password && (
        <HelperText type="error" testID="password-error">
          {errors.password.message}
        </HelperText>
      )}

      <Controller
        control={control}
        name="confirmationText"
        rules={{
          required: t('profile.confirmationTextInvalid'),
          validate: (value) =>
            value === 'DELETE MY ACCOUNT' || t('profile.confirmationTextInvalid'),
        }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <TextInput
            label={t('profile.confirmationText')}
            mode="outlined"
            left={<TextInput.Icon icon="text-box-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.confirmationText}
            ref={ref}
            returnKeyType="done"
            testID="confirmationText-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.confirmationText && (
        <HelperText type="error" testID="confirmationText-error">
          {errors.confirmationText.message}
        </HelperText>
      )}

      {apiError && (
        <HelperText type="error" testID="api-error">
          {apiError}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="trash-can-outline"
        buttonColor="#D97A6B"
        onPress={handleSubmit(handleDelete)}
        loading={isLoading}
        disabled={isLoading}
        testID="delete-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {t('profile.deleteAccount')}
      </Button>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  warningCard: {
    backgroundColor: '#FAEAE7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FAEAE7',
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningTitle: { color: '#C46A5D', fontWeight: '700' },
  warningText: { color: '#9B4E44', lineHeight: 22 },
  input: { marginBottom: 8, marginHorizontal: 16 },
  outline: { borderRadius: 12 },
  button: { marginTop: 20, marginHorizontal: 16, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 8, flexDirection: 'row-reverse' },
});
