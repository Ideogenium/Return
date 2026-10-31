import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Portal, Dialog } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { convertPhotoToJpeg, MAX_PHOTO_DIMENSION } from '../../utils/photo';

interface PhotoPickerProps {
  /** Receives the URI of the photo converted to JPEG, ready to upload. */
  onPhotoPicked: (uri: string) => void;
  currentPhotoCount: number;
  disabled?: boolean;
  /** Longest side of the converted photo, in pixels (an avatar needs less than an item photo). */
  maxDimension?: number;
}

export function PhotoPicker({
  onPhotoPicked,
  currentPhotoCount,
  disabled,
  maxDimension = MAX_PHOTO_DIMENSION,
}: PhotoPickerProps) {
  const { t } = useTranslation();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();
  const isMaxReached = currentPhotoCount >= 5;

  /**
   * Every picked photo is converted to JPEG before it leaves the picker (see convertPhotoToJpeg):
   * no format or weight check is needed here, the converted file always meets the contract.
   */
  const handleResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setValidationError(undefined);
    setIsConverting(true);
    try {
      const jpegUri = await convertPhotoToJpeg(asset, maxDimension);
      onPhotoPicked(jpegUri);
    } catch {
      setValidationError(t('items.photoConversionFailed'));
    } finally {
      setIsConverting(false);
    }
  };

  // quality 1: the picker hands over the original, the only lossy encoding is the JPEG conversion.
  const handleCamera = async () => {
    setDialogVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    await handleResult(result);
  };

  const handleGallery = async () => {
    setDialogVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    await handleResult(result);
  };

  return (
    <>
      <Button
        mode="outlined"
        icon="camera-plus-outline"
        onPress={() => setDialogVisible(true)}
        disabled={disabled || isMaxReached || isConverting}
        loading={isConverting}
        testID="photo-picker-btn"
        style={styles.button}
      >
        {t('items.addPhoto')}
      </Button>

      {validationError && (
        <HelperText type="error" testID="photo-validation-error">
          {validationError}
        </HelperText>
      )}

      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          testID="photo-picker-dialog"
        >
          <Dialog.Title>{t('items.addPhoto')}</Dialog.Title>
          <Dialog.Actions style={styles.dialogActions}>
            <Button icon="camera" onPress={handleCamera} testID="photo-picker-camera">
              {t('items.takePhoto')}
            </Button>
            <Button icon="image" onPress={handleGallery} testID="photo-picker-gallery">
              {t('items.chooseFromGallery')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, borderColor: '#C9C4BB' },
  dialogActions: { flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16 },
});
