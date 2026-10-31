import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text, HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ItemForm } from '../../components/items/ItemForm';
import { PhotoGallery } from '../../components/items/PhotoGallery';
import { PhotoPicker } from '../../components/items/PhotoPicker';
import { buildPhotoFormData } from '../../utils/photo';
import { useItemStore } from '../../stores/useItemStore';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import type { ItemStackParamList } from '../../navigation/types';
import type { CreateItemDto, Photo } from '../../types/api.types';
import type { AxiosError } from 'axios';
import { FormScrollView } from '../../components/common/FormScrollView';

type Props = NativeStackScreenProps<ItemStackParamList, 'CreateItem'>;

export function CreateItemScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | undefined>();

  const handleSubmit = async (data: CreateItemDto) => {
    setIsLoading(true);
    setApiError(undefined);
    try {
      const item = await useItemStore.getState().createItem(data);
      if (data.category === 'MONEY') {
        navigation.goBack();
        return;
      }
      setCreatedItemId(item.id);
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoPicked = async (uri: string) => {
    if (!createdItemId) return;
    setPhotoError(undefined);

    try {
      const formData = await buildPhotoFormData(uri);
      const photo = await useItemStore.getState().uploadPhoto(createdItemId, formData);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setPhotoError(problem ? getErrorMessage(problem, t) : t('items.photoUploadFailed'));
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  // Step 2: Photo upload after item creation
  if (createdItemId) {
    return (
      <FormScrollView contentContainerStyle={styles.container} testID="create-item-photos">
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('items.photos')}
        </Text>
        <PhotoGallery photos={photos} />
        <PhotoPicker onPhotoPicked={handlePhotoPicked} currentPhotoCount={photos.length} />
        {photoError && (
          <HelperText type="error" testID="photo-error">
            {photoError}
          </HelperText>
        )}
        <Button mode="contained" onPress={handleDone} testID="done-btn" style={styles.doneButton}>
          {t('common.save')}
        </Button>
      </FormScrollView>
    );
  }

  // Step 1: Item form
  return (
    <FormScrollView contentContainerStyle={styles.container} testID="create-item-form">
      <ItemForm
        mode="create"
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={apiError}
        submitLabel={t('items.addItem')}
      />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  sectionTitle: { color: '#2D3748', fontWeight: '600', marginBottom: 12 },
  doneButton: { marginTop: 24, borderRadius: 12 },
});
