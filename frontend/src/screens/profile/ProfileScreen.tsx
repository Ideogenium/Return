import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileCard } from '../../components/profile/ProfileCard';
import { LenderStats } from '../../components/profile/LenderStats';
import { PhotoPicker } from '../../components/items/PhotoPicker';
import { buildPhotoFormData } from '../../utils/photo';
import { useAuthStore } from '../../stores/useAuthStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    if (!user) {
      // Not hydrate(): the session restore shows the app-wide splash and unmounts the navigation.
      useAuthStore.getState().refreshUser();
    }
  }, [user]);

  // Refresh statistics each time the screen comes into focus (covers FIX-07 / FIX-08)
  useFocusEffect(
    useCallback(() => {
      useHistoryStore.getState().fetchStatistics();
    }, []),
  );

  const handleAvatarPicked = async (uri: string) => {
    try {
      const formData = await buildPhotoFormData(uri, 'avatar');
      await useAuthStore.getState().updateAvatar(formData);
      setSnackbar({ message: t('profile.profileUpdated'), type: 'success' });
    } catch {
      setSnackbar({ message: t('errors.unknownError'), type: 'error' });
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await useAuthStore.getState().deleteAvatar();
      setSnackbar({ message: t('profile.profileUpdated'), type: 'success' });
    } catch {
      setSnackbar({ message: t('errors.unknownError'), type: 'error' });
    }
  };

  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarSection}>
        <ProfileCard user={user} />
        <View style={styles.photoPickerWrapper}>
          <PhotoPicker onPhotoPicked={handleAvatarPicked} currentPhotoCount={0} />
          {user.profilePicture && (
            <Button
              mode="text"
              icon="delete-outline"
              onPress={handleDeleteAvatar}
              textColor="#D97A6B"
              compact
              testID="delete-avatar-btn"
              style={styles.deleteAvatarBtn}
            >
              {t('profile.deletePhoto')}
            </Button>
          )}
        </View>
      </View>

      <LenderStats />

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-edit-outline"
          onPress={() => navigation.navigate('EditProfile')}
          style={styles.primaryButton}
          labelStyle={styles.buttonLabel}
          contentStyle={styles.buttonContent}
          testID="edit-profile-btn"
        >
          {t('profile.editProfile')}
        </Button>

        <Button
          mode="outlined"
          icon="lock-outline"
          onPress={() => navigation.navigate('ChangePassword')}
          style={styles.outlinedButton}
          labelStyle={styles.outlinedLabel}
          contentStyle={styles.buttonContent}
          testID="change-password-btn"
        >
          {t('profile.changePassword')}
        </Button>

        <Button
          mode="outlined"
          icon="cog-outline"
          onPress={() => navigation.navigate('Settings')}
          style={styles.outlinedButton}
          labelStyle={styles.outlinedLabel}
          contentStyle={styles.buttonContent}
          testID="settings-btn"
        >
          {t('profile.settings')}
        </Button>

        <Button
          mode="outlined"
          icon="alert-circle-outline"
          onPress={() => navigation.navigate('DeleteAccount')}
          style={styles.dangerButton}
          textColor="#D97A6B"
          labelStyle={styles.outlinedLabel}
          contentStyle={styles.buttonContent}
          testID="delete-account-btn"
        >
          {t('profile.deleteAccount')}
        </Button>

        <Button
          mode="text"
          icon="logout"
          onPress={logout}
          style={styles.logoutButton}
          textColor="#A8B5BF"
          labelStyle={styles.logoutLabel}
          testID="logout-btn"
        >
          {t('auth.logout')}
        </Button>
      </View>
      <Snackbar
        visible={snackbar !== null}
        onDismiss={() => setSnackbar(null)}
        duration={3000}
        style={snackbar?.type === 'error' ? styles.snackbarError : undefined}
        testID="profile-snackbar"
      >
        {snackbar?.message ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32, backgroundColor: '#F7F4EF' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actions: { paddingHorizontal: 16, gap: 10 },
  primaryButton: { borderRadius: 12 },
  buttonLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 6 },
  outlinedButton: { borderRadius: 12, borderColor: '#C9C4BB' },
  outlinedLabel: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  dangerButton: { borderRadius: 12, borderColor: '#FAEAE7' },
  logoutButton: { marginTop: 8 },
  logoutLabel: { fontSize: 14 },
  avatarSection: { position: 'relative' },
  photoPickerWrapper: { alignSelf: 'center', alignItems: 'center', marginVertical: 8 },
  deleteAvatarBtn: { marginTop: 4 },
  snackbarError: { backgroundColor: '#D97A6B' },
});
