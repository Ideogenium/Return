import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import { PASSWORD_SPECIAL_CHARACTERS, validatePasswordRules } from '../../utils/password';

interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

interface ChangePasswordFormProps {
  onSubmit: (data: { currentPassword: string; newPassword: string }) => void;
  isLoading: boolean;
  error?: string;
  /** Field-level messages derived from an API validation error. */
  fieldErrors?: Partial<Record<'currentPassword' | 'newPassword', string>>;
}

export function ChangePasswordForm({
  onSubmit,
  isLoading,
  error,
  fieldErrors,
}: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const [currentVisible, setCurrentVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
  } = useForm<ChangePasswordFormData>();

  useEffect(() => {
    Object.entries(fieldErrors ?? {}).forEach(([field, message]) => {
      if (message) setError(field as keyof ChangePasswordFormData, { type: 'server', message });
    });
  }, [fieldErrors, setError]);

  const newPassword = watch('newPassword');

  const handleFormSubmit = (data: ChangePasswordFormData) => {
    onSubmit({ currentPassword: data.currentPassword, newPassword: data.newPassword });
  };

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="currentPassword"
        rules={{ required: t('auth.passwordRequired') }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('profile.currentPassword')}
            mode="outlined"
            secureTextEntry={!currentVisible}
            left={<TextInput.Icon icon="lock-outline" color="#A8B5BF" />}
            right={
              <TextInput.Icon
                icon={currentVisible ? 'eye-off' : 'eye'}
                onPress={() => setCurrentVisible((v) => !v)}
              />
            }
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.currentPassword}
            testID="currentPassword-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.currentPassword && (
        <HelperText type="error" testID="currentPassword-error">
          {errors.currentPassword.message}
        </HelperText>
      )}

      <Controller
        control={control}
        name="newPassword"
        rules={{
          required: t('auth.passwordRequired'),
          minLength: { value: 8, message: t('auth.passwordMinLength') },
          maxLength: { value: 100, message: t('auth.passwordMaxLength') },
          validate: (value) => validatePasswordRules(value, t),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('profile.newPassword')}
            mode="outlined"
            secureTextEntry={!newVisible}
            left={<TextInput.Icon icon="lock-plus-outline" color="#A8B5BF" />}
            right={
              <TextInput.Icon
                icon={newVisible ? 'eye-off' : 'eye'}
                onPress={() => setNewVisible((v) => !v)}
              />
            }
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.newPassword}
            testID="newPassword-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.newPassword ? (
        <HelperText type="error" testID="newPassword-error">
          {errors.newPassword.message}
        </HelperText>
      ) : (
        <HelperText type="info" testID="newPassword-rules">
          {t('auth.passwordRules', { allowed: PASSWORD_SPECIAL_CHARACTERS })}
        </HelperText>
      )}

      <Controller
        control={control}
        name="confirmNewPassword"
        rules={{
          required: t('auth.confirmPasswordRequired'),
          validate: (value) => value === newPassword || t('auth.passwordsMismatch'),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('profile.confirmNewPassword')}
            mode="outlined"
            secureTextEntry={!confirmVisible}
            left={<TextInput.Icon icon="lock-check-outline" color="#A8B5BF" />}
            right={
              <TextInput.Icon
                icon={confirmVisible ? 'eye-off' : 'eye'}
                onPress={() => setConfirmVisible((v) => !v)}
              />
            }
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.confirmNewPassword}
            testID="confirmNewPassword-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.confirmNewPassword && (
        <HelperText type="error" testID="confirmNewPassword-error">
          {errors.confirmNewPassword.message}
        </HelperText>
      )}

      {error && (
        <HelperText type="error" testID="form-error">
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="lock-reset"
        onPress={handleSubmit(handleFormSubmit)}
        loading={isLoading}
        disabled={isLoading}
        testID="changePassword-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {t('profile.changePassword')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  input: { marginBottom: 8 },
  outline: { borderRadius: 12 },
  button: { marginTop: 20, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 8, flexDirection: 'row-reverse' },
});
