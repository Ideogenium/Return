import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { CreateBorrowerDto } from '../../types/api.types';
import { EMAIL_PATTERN, normalizeEmail } from '../../utils/email';

interface BorrowerFormProps {
  mode?: 'create' | 'edit';
  defaultValues?: Partial<CreateBorrowerDto>;
  onSubmit: (data: CreateBorrowerDto) => void;
  isLoading: boolean;
  error?: string;
  submitLabel: string;
}

export function BorrowerForm({
  mode = 'create',
  defaultValues,
  onSubmit,
  isLoading,
  error,
  submitLabel,
}: BorrowerFormProps) {
  const { t } = useTranslation();
  const isCreate = mode === 'create';
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBorrowerDto>({
    defaultValues: {
      firstName: defaultValues?.firstName ?? '',
      lastName: defaultValues?.lastName ?? '',
      email: defaultValues?.email ?? '',
      phoneNumber: defaultValues?.phoneNumber ?? undefined,
    },
  });

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="firstName"
        rules={{
          ...(isCreate && { required: t('auth.firstNameRequired') }),
          minLength: { value: 1, message: t('auth.firstNameRequired') },
          maxLength: { value: 50, message: t('auth.nameMaxLength') },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('borrowers.firstName')}
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

      <Controller
        control={control}
        name="lastName"
        rules={{
          ...(isCreate && { required: t('auth.lastNameRequired') }),
          minLength: { value: 1, message: t('auth.lastNameRequired') },
          maxLength: { value: 50, message: t('auth.nameMaxLength') },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('borrowers.lastName')}
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

      <Controller
        control={control}
        name="email"
        rules={{
          ...(isCreate && { required: t('auth.emailRequired') }),
          ...(isCreate && {
            validate: (value: string) =>
              EMAIL_PATTERN.test(normalizeEmail(value)) || t('auth.emailInvalid'),
          }),
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('borrowers.email')}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.email}
            editable={isCreate}
            disabled={!isCreate}
            testID="email-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />
      {errors.email ? (
        <HelperText type="error" testID="email-error">
          {errors.email.message}
        </HelperText>
      ) : !isCreate ? (
        <HelperText type="info" testID="email-readonly-hint">
          {t('borrowers.emailReadonly')}
        </HelperText>
      ) : null}

      <Controller
        control={control}
        name="phoneNumber"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label={t('borrowers.phone')}
            mode="outlined"
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone-outline" color="#A8B5BF" />}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value ?? undefined}
            testID="phone-input"
            style={[styles.input, ui.input]}
            outlineStyle={styles.outline}
          />
        )}
      />

      {error && (
        <HelperText type="error" testID="form-error">
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={handleSubmit((data) =>
          onSubmit({ ...data, ...(data.email && { email: normalizeEmail(data.email) }) }),
        )}
        loading={isLoading}
        disabled={isLoading}
        testID="borrower-submit-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {submitLabel}
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
