import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { LoginDto } from '../../types/api.types';
import { EMAIL_PATTERN, normalizeEmail } from '../../utils/email';

interface LoginFormProps {
  onSubmit: (data: LoginDto) => void;
  isLoading: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const { t } = useTranslation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <View style={styles.container}>
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
        // Verification of an existing password: only required, as in the API (LoginDto).
        rules={{ required: t('auth.passwordRequired') }}
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
      {errors.password && (
        <HelperText type="error" testID="password-error">
          {errors.password.message}
        </HelperText>
      )}

      {error && (
        <HelperText type="error" testID="form-error">
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="login"
        onPress={handleSubmit((data) => onSubmit({ ...data, email: normalizeEmail(data.email) }))}
        loading={isLoading}
        disabled={isLoading}
        testID="login-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {t('auth.login')}
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
