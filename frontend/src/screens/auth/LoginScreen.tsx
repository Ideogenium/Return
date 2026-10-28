import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAuthStore } from '../../stores/useAuthStore';
import { getErrorMessage } from '../../utils/error';
import type { AuthStackParamList } from '../../navigation/types';
import type { LoginDto } from '../../types/api.types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoading, error, login, clearError } = useAuthStore();

  const handleSubmit = async (data: LoginDto) => {
    try {
      await login(data.email, data.password);
    } catch {
      // L'erreur est gérée par le store
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoRow}>
        <Image
          source={require('../../../assets/branding/return-logo-horizontal.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Return"
        />
      </View>

      <Text variant="titleLarge" style={styles.title}>
        {t('auth.loginTitle')}
      </Text>

      <LoginForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error ? getErrorMessage(error, t) : undefined}
      />

      <Button
        mode="text"
        onPress={() => {
          clearError();
          navigation.navigate('Register');
        }}
        testID="go-register"
        textColor="#6B8E7B"
        labelStyle={styles.linkLabel}
      >
        {t('auth.noAccount')}
      </Button>
    </ScrollView>
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
