import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import {
  Text,
  Button,
  ActivityIndicator,
  Portal,
  Dialog,
  HelperText,
  Icon,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PhotoGallery } from '../../components/items/PhotoGallery';
import { PhotoPicker } from '../../components/items/PhotoPicker';
import { buildPhotoFormData } from '../../utils/photo';
import { CATEGORY_I18N } from '../../components/items/ItemCard';
import { useItemStore } from '../../stores/useItemStore';
import { RefreshError } from '../../components/common/RefreshError';
import { useEntityLoad } from '../../hooks/useEntityLoad';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import { ui } from '../../config/theme.config';
import type { ItemStackParamList } from '../../navigation/types';
import type { AxiosError } from 'axios';

type Props = NativeStackScreenProps<ItemStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { selectedItem, fetchItem } = useItemStore();
  const { loadError, reload } = useEntityLoad(id, fetchItem);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | undefined>();

  const handleDelete = async () => {
    setDeleteDialogVisible(false);
    setApiError(undefined);
    try {
      await useItemStore.getState().deleteItem(id);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    }
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoId) return;
    const photoId = deletePhotoId;
    setDeletePhotoId(null);
    setApiError(undefined);
    try {
      await useItemStore.getState().deletePhoto(id, photoId);
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('items.photoDeleteFailed'));
    }
  };

  const handlePhotoPicked = async (uri: string) => {
    setApiError(undefined);

    try {
      const formData = await buildPhotoFormData(uri);
      await useItemStore.getState().uploadPhoto(id, formData);
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('items.photoUploadFailed'));
    }
  };

  // Full-screen states only while nothing is displayable for this id: actions and
  // refreshes keep the screen (and its open dialogs) mounted.
  if (!selectedItem || selectedItem.id !== id) {
    if (!loadError) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
        </View>
      );
    }
    return (
      <View style={styles.centerContainer} testID="item-error">
        <Text variant="titleMedium" style={styles.errorText}>
          {loadError.type?.includes('item-not-found')
            ? t('errors.itemNotFound')
            : t('errors.unknownError')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
          {t('common.back')}
        </Button>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} testID="item-detail">
      {loadError && <RefreshError problem={loadError} onRetry={reload} />}
      {/* Photos section */}
      {selectedItem.photos && selectedItem.photos.length > 0 && (
        <View style={styles.photoSection}>
          <PhotoGallery
            photos={selectedItem.photos}
            onDeletePress={(photoId) => setDeletePhotoId(photoId)}
          />
        </View>
      )}

      <View style={styles.photoPickerContainer}>
        <PhotoPicker
          onPhotoPicked={handlePhotoPicked}
          currentPhotoCount={selectedItem.photos?.length ?? 0}
        />
      </View>

      {/* Info card */}
      <View style={[styles.infoCard, ui.card]}>
        <View style={styles.header}>
          <Icon source="package-variant-closed" size={32} color="#4A6355" />
          <Text variant="headlineSmall" style={styles.name}>
            {selectedItem.name}
          </Text>
        </View>

        <View style={styles.field}>
          <Text variant="labelMedium" style={styles.label}>
            {t('items.category')}
          </Text>
          <Text variant="bodyMedium" style={styles.value}>
            {t(CATEGORY_I18N[selectedItem.category])}
          </Text>
        </View>

        {selectedItem.description && (
          <View style={styles.field}>
            <Text variant="labelMedium" style={styles.label}>
              {t('items.description')}
            </Text>
            <Text variant="bodyMedium" style={styles.value}>
              {selectedItem.description}
            </Text>
          </View>
        )}

        {selectedItem.estimatedValue != null && (
          <View style={styles.field}>
            <Text variant="labelMedium" style={styles.label}>
              {t('items.estimatedValue')}
            </Text>
            <Text variant="bodyMedium" style={styles.value}>
              {selectedItem.estimatedValue.toFixed(2)} €
            </Text>
          </View>
        )}
      </View>

      {apiError && (
        <HelperText type="error" testID="api-error" style={styles.apiError}>
          {apiError}
        </HelperText>
      )}

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="pencil-outline"
          onPress={() => navigation.navigate('EditItem', { id })}
          style={styles.primaryButton}
          labelStyle={styles.buttonLabel}
          contentStyle={styles.buttonContent}
          testID="edit-item-btn"
        >
          {t('items.editItem')}
        </Button>

        <Button
          mode="outlined"
          icon="trash-can-outline"
          onPress={() => setDeleteDialogVisible(true)}
          style={styles.dangerButton}
          textColor="#D97A6B"
          labelStyle={styles.buttonLabel}
          contentStyle={styles.buttonContent}
          testID="delete-item-btn"
        >
          {t('common.delete')}
        </Button>
      </View>

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          testID="confirm-delete-dialog"
        >
          <Dialog.Title>{t('items.confirmDelete')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('items.deleteWarning')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} testID="cancel-delete-btn">
              {t('common.cancel')}
            </Button>
            <Button onPress={handleDelete} textColor="#D97A6B" testID="confirm-delete-btn">
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deletePhotoId !== null}
          onDismiss={() => setDeletePhotoId(null)}
          testID="confirm-delete-photo-dialog"
        >
          <Dialog.Title>{t('items.deletePhoto')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('items.confirmDeletePhoto')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletePhotoId(null)} testID="cancel-delete-photo-btn">
              {t('common.cancel')}
            </Button>
            <Button
              onPress={handleDeletePhoto}
              textColor="#D97A6B"
              testID="confirm-delete-photo-btn"
            >
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#6B7A8D', textAlign: 'center', marginBottom: 16 },
  backButton: { borderRadius: 12 },
  photoSection: { paddingHorizontal: 16, paddingTop: 16 },
  infoCard: { margin: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  name: { color: '#2D3748', fontWeight: '700', flex: 1 },
  field: { marginBottom: 12 },
  label: { color: '#A8B5BF', marginBottom: 2 },
  value: { color: '#2D3748' },
  apiError: { marginHorizontal: 16 },
  actions: { paddingHorizontal: 16, gap: 10, marginTop: 8 },
  primaryButton: { borderRadius: 12 },
  dangerButton: { borderRadius: 12, borderColor: '#FAEAE7' },
  buttonLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  buttonContent: { paddingVertical: 6 },
  photoPickerContainer: { alignSelf: 'center', marginVertical: 8 },
});
