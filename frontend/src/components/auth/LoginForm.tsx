import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { LoginDto } from '../../types/api.types';
import { normalizeEmail, validateRequiredEmail } from '../../utils/email';

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
    setFocus,
    formState: { errors },
  } = useForm<LoginDto>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const submitForm = handleSubmit((data) =>
    onSubmit({ ...data, email: normalizeEmail(data.email) }),
  );
  // The return key of the last field submits like the button, never while it is disabled.
  const submitFromKeyboard = () => {
    if (!isLoading) void submitForm();
  };

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="email"
        rules={{ validate: (value) => validateRequiredEmail(value, t) }}
        render={({ field: { onChange, onBlur, value, ref } }) => (
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
            ref={ref}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => setFocus('password')}
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
        render={({ field: { onChange, onBlur, value, ref } }) => (
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
            ref={ref}
            returnKeyType="done"
            onSubmitEditing={submitFromKeyboard}
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
        onPress={submitForm}
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
