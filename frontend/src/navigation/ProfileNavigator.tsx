import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { LoanDetailScreen } from '../screens/loans/LoanDetailScreen';
import { NotificationBell } from '../components/notifications/NotificationBell';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerTintColor: '#2D3748',
  headerTitleStyle: { fontWeight: '600' as const },
  headerShadowVisible: false,
};

export function ProfileNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('profile.title'), headerRight: () => <NotificationBell /> }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: t('profile.editProfile') }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: t('profile.changePassword') }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: t('profile.deleteAccount') }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('settings.title') }}
      />
      <Stack.Screen
        name="LoanHistory"
        component={HistoryScreen}
        options={{ title: t('history.title') }}
      />
      {/* Same screen as in the Loan stack: back from a loan opened in the history returns to the list */}
      <Stack.Screen
        name="LoanDetail"
        component={LoanDetailScreen}
        options={{ title: t('loans.details') }}
      />
    </Stack.Navigator>
  );
}
