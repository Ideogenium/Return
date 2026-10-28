import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { TextInput, Button, HelperText, Text, Menu } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import type { User, UpdateProfileDto } from '../../types/api.types';
import { validateOptionalEmail, withNormalizedEmail } from '../../utils/email';

const COUNTRY_CODES = [
  { code: 'FR', dial: '+33', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'BE', dial: '+32', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'CH', dial: '+41', flag: '\u{1F1E8}\u{1F1ED}' },
  { code: 'CA', dial: '+1', flag: '\u{1F1E8}\u{1F1E6}' },
  { code: 'US', dial: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'GB', dial: '+44', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'DE', dial: '+49', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'ES', dial: '+34', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'IT', dial: '+39', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'PT', dial: '+351', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'NL', dial: '+31', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'MA', dial: '+212', flag: '\u{1F1F2}\u{1F1E6}' },
  { code: 'DZ', dial: '+213', flag: '\u{1F1E9}\u{1F1FF}' },
  { code: 'TN', dial: '+216', flag: '\u{1F1F9}\u{1F1F3}' },
  { code: 'SN', dial: '+221', flag: '\u{1F1F8}\u{1F1F3}' },
  { code: 'CI', dial: '+225', flag: '\u{1F1E8}\u{1F1EE}' },
  { code: 'CM', dial: '+237', flag: '\u{1F1E8}\u{1F1F2}' },
];

function parsePhone(phone: string | undefined | null) {
  if (!phone) return { dialCode: '+33', national: '' };
  for (const c of COUNTRY_CODES) {
    if (phone.startsWith(c.dial)) {
      return { dialCode: c.dial, national: phone.slice(c.dial.length) };
    }
  }
  // Fallback: try to extract dial code from +XX or +XXX pattern
  const match = phone.match(/^(\+\d{1,3})(.*)/);
  if (match) return { dialCode: match[1] ?? '+33', national: match[2] ?? '' };
  return { dialCode: '+33', national: phone };
}

interface EditProfileFormProps {
  user: User;
  onSubmit: (data: UpdateProfileDto) => void;
  isLoading: boolean;
}

export function EditProfileForm({ user, onSubmit, isLoading }: EditProfileFormProps) {
  const { t } = useTranslation();
  const parsed = parsePhone(user.phone);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.national);
  const [menuVisible, setMenuVisible] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpdateProfileDto>({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
    },
  });

  const selectedCountry = COUNTRY_CODES.find((c) => c.dial === dialCode) ?? COUNTRY_CODES[0]!;

  const updatePhone = (dial: string, national: string) => {
    if (national) {
      setValue('phone', `${dial}${national}`);
    } else {
      setValue('phone', '');
    }
  };

  return (
    <View style={styles.container}>
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

      <Controller
        control={control}
        name="email"
        rules={{
          validate: (value) => validateOptionalEmail(value, t),
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

      <Text variant="labelMedium" style={styles.phoneLabel}>
        {t('profile.phone')}
      </Text>
      <Controller
        control={control}
        name="phone"
        rules={{
          pattern: {
            value: /^\+[1-9]\d{6,14}$/,
            message: t('profile.phoneInvalidFormat'),
          },
        }}
        render={() => (
          <View style={styles.phoneRow}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setMenuVisible(true)}
                  style={styles.countrySelector}
                  testID="country-code-btn"
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryDial}>{dialCode}</Text>
                  <Text style={styles.chevron}>{'\u25BE'}</Text>
                </Pressable>
              }
              contentStyle={styles.menuContent}
            >
              {COUNTRY_CODES.map((c) => (
                <Menu.Item
                  key={`${c.code}-${c.dial}`}
                  onPress={() => {
                    setDialCode(c.dial);
                    setMenuVisible(false);
                    updatePhone(c.dial, nationalNumber);
                  }}
                  title={`${c.flag}  ${c.code}  ${c.dial}`}
                  testID={`country-${c.code}`}
                />
              ))}
            </Menu>
            <TextInput
              mode="outlined"
              keyboardType="phone-pad"
              placeholder="612345678"
              value={nationalNumber}
              onChangeText={(text) => {
                setNationalNumber(text);
                updatePhone(dialCode, text);
              }}
              error={!!errors.phone}
              testID="phone-input"
              style={[styles.phoneInput, ui.input]}
              outlineStyle={styles.outline}
            />
          </View>
        )}
      />
      {errors.phone && (
        <HelperText type="error" testID="phone-error">
          {errors.phone.message}
        </HelperText>
      )}

      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={handleSubmit((data) => onSubmit(withNormalizedEmail(data)))}
        loading={isLoading}
        disabled={isLoading}
        testID="save-btn"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
      >
        {t('common.save')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  input: { marginBottom: 8 },
  outline: { borderRadius: 12 },
  phoneLabel: { color: '#A8B5BF', marginBottom: 6, marginTop: 4 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C9C4BB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  countryFlag: { fontSize: 20 },
  countryDial: { fontSize: 15, color: '#2D3748', fontWeight: '600' },
  chevron: { fontSize: 12, color: '#A8B5BF', marginLeft: 2 },
  menuContent: { maxHeight: 300 },
  phoneInput: { flex: 1 },
  button: { marginTop: 20, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 8, flexDirection: 'row-reverse' },
});
