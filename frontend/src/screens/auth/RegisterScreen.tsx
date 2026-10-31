import { Image, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { useAuthStore } from '../../stores/useAuthStore';
import { getErrorMessage, getFieldErrors } from '../../utils/error';
import type { AuthStackParamList } from '../../navigation/types';
import { FormScrollView } from '../../components/common/FormScrollView';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Fields displayed by RegisterForm: API errors on any other field fall back to the banner. */
const REGISTER_FIELDS = ['email', 'password', 'firstName', 'lastName'] as const;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoading, error, register, clearError } = useAuthStore();
  // A field validation error is shown under its field; anything else as a form message.
  const fieldErrors = error ? getFieldErrors(error, t, REGISTER_FIELDS) : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const handleSubmit = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    try {
      await register(data.email, data.password, data.firstName, data.lastName);
    } catch {
      // L'erreur est gérée par le store
    }
  };

  return (
    <FormScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoRow}>
        <Image
          source={require('../../../assets/branding/return-logo-horizontal.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Return"
        />
      </View>

      <Text variant="titleLarge" style={styles.title}>
        {t('auth.registerTitle')}
      </Text>

      <RegisterForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error && !hasFieldErrors ? getErrorMessage(error, t) : undefined}
        fieldErrors={hasFieldErrors ? fieldErrors : undefined}
      />

      <Button
        mode="text"
        onPress={() => {
          clearError();
          navigation.navigate('Login');
        }}
        testID="go-login"
        textColor="#6B8E7B"
        labelStyle={styles.linkLabel}
      >
        {t('auth.hasAccount')}
      </Button>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F7F4EF' },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  logo: { width: 200, height: 58 },
  title: { textAlign: 'center', marginBottom: 24, color: '#6B7A8D' },
  linkLabel: { fontSize: 14, letterSpacing: 0.3 },
});
