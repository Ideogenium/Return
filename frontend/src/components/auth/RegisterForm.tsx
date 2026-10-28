import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import { PASSWORD_SPECIAL_CHARACTERS, validatePasswordRules } from '../../utils/password';
import { EMAIL_PATTERN, normalizeEmail } from '../../utils/email';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

interface RegisterFormProps {
  onSubmit: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => void;
  isLoading: boolean;
  error?: string;
  /** Field-level messages derived from an API validation error. */
  fieldErrors?: Partial<Record<'email' | 'password' | 'firstName' | 'lastName', string>>;
}

export function RegisterForm({ onSubmit, isLoading, error, fieldErrors }: RegisterFormProps) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
  } = useForm<RegisterFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  useEffect(() => {
    Object.entries(fieldErrors ?? {}).forEach(([field, message]) => {
      if (message) setError(field as keyof RegisterFormData, { type: 'server', message });
    });
  }, [fieldErrors, setError]);

  const handleFormSubmit = (data: RegisterFormData) => {
    onSubmit({
      email: normalizeEmail(data.email),
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.half}>
          <Controller
            control={control}
            name="firstName"
            rules={{
              required: t('auth.firstNameRequired'),
              maxLength: { value: 50, message: t('auth.nameMaxLength') },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label={t('auth.firstName')}
                mode="outlined"
                left={<TextInput.Icon icon="account-outline" color="#A8B5BF" />}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.firstName}
                testID="firstName-input"
                style={[styles.input, ui.input]}
                outlineStyle={styles.outline}
              />
            )}
          />
          {errors.firstName && (
            <HelperText type="error" testID="firstName-error">
              {errors.firstName.message}
            </HelperText>
          )}
        </View>
        <View style={styles.half}>
          <Controller
            control={control}
            name="lastName"
            rules={{
              required: t('auth.lastNameRequired'),
              maxLength: { value: 50, message: t('auth.nameMaxLength') },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label={t('auth.lastName')}
                mode="outlined"
                left={<TextInput.Icon icon="account-outline" color="#A8B5BF" />}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.lastName}
                testID="lastName-input"
                style={[styles.input, ui.input]}
                outlineStyle={styles.outline}
              />
            )}
          />
          {errors.lastName && (
            <HelperText type="error" testID="lastName-error">
              {errors.lastName.message}
            </HelperText>
          )}
        </View>
      </View>

      <Controller
        control={control}
        name="email"
        rules={{
          required: t('auth.emailRequired'),
          validate: (value) => EMAIL_PATTERN.test(normalizeEmail(value)) || t('auth.emailInvalid'),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('auth.email')}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.email}
            testID="email-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.email && (
        <HelperText type="error" testID="email-error">
          {errors.email.message}
        </HelperText>
      )}

      <Controller
        control={control}
        name="password"
        rules={{
          required: t('auth.passwordRequired'),
          minLength: { value: 8, message: t('auth.passwordMinLength') },
          maxLength: { value: 100, message: t('auth.passwordMaxLength') },
          validate: (value) => validatePasswordRules(value, t),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('auth.password')}
            mode="outlined"
            secureTextEntry={!passwordVisible}
            left={<TextInput.Icon icon="lock-outline" color="#A8B5BF" />}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
              />
            }
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.password}
            testID="password-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.password ? (
        <HelperText type="error" testID="password-error">
          {errors.password.message}
        </HelperText>
      ) : (
        <HelperText type="info" testID="password-rules">
          {t('auth.passwordRules', { allowed: PASSWORD_SPECIAL_CHARACTERS })}
        </HelperText>
      )}

      <Controller
        control={control}
        name="confirmPassword"
        rules={{
          required: t('auth.confirmPasswordRequired'),
          validate: (value) => value === password || t('auth.passwordsMismatch'),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('auth.confirmPassword')}
            mode="outlined"
            secureTextEntry={!confirmPasswordVisible}
            left={<TextInput.Icon icon="lock-check-outline" color="#A8B5BF" />}
            right={
              <TextInput.Icon
                icon={confirmPasswordVisible ? 'eye-off' : 'eye'}
                onPress={() => setConfirmPasswordVisible((v) => !v)}
              />
            }
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.confirmPassword}
            testID="confirmPassword-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.confirmPassword && (
        <HelperText type="error" testID="confirmPassword-error">
          {errors.confirmPassword.message}
        </HelperText>
      )}

      {error && (
        <HelperText type="error" testID="form-error">
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="account-plus-outline"
        onPress={handleSubmit(handleFormSubmit)}
        loading={isLoading}
        disabled={isLoading}
        testID="register-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {t('auth.register')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: { marginBottom: 8 },
  outline: { borderRadius: 12 },
  button: { marginTop: 20, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 8, flexDirection: 'row-reverse' },
});
