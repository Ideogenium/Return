import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EditProfileForm } from '../../components/profile/EditProfileForm';
import { useAuthStore } from '../../stores/useAuthStore';
import apiClient from '../../api/apiClient';
import type { AppStackParamList } from '../../navigation/types';
import type { User, UpdateProfileDto } from '../../types/api.types';
import { FormScrollView } from '../../components/common/FormScrollView';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { t: _t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async (data: UpdateProfileDto) => {
    setIsLoading(true);
    try {
      const { data: updatedUser } = await apiClient.patch<User>('/users/me', data);
      useAuthStore.setState({ user: updatedUser });
      navigation.goBack();
    } catch {
      // Erreur gérée par l'intercepteur
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormScrollView contentContainerStyle={styles.container}>
      <EditProfileForm user={user} onSubmit={handleSubmit} isLoading={isLoading} />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
});
