import { useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { Photo } from '../../types/api.types';
import { PhotoViewer } from './PhotoViewer';

interface PhotoGalleryProps {
  photos: Photo[];
  onAddPress?: () => void;
  onDeletePress?: (photoId: string) => void;
  maxPhotos?: number;
  /** Display-only mode (e.g. borrower view): hides quota and add/delete controls */
  readOnly?: boolean;
}

export function PhotoGallery({
  photos,
  onAddPress,
  onDeletePress,
  maxPhotos = 5,
  readOnly = false,
}: PhotoGalleryProps) {
  const { t } = useTranslation();
  const canAdd = photos.length < maxPhotos;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <View style={styles.container} testID="photo-gallery">
      {!readOnly && (
        <Text variant="labelLarge" style={styles.counter}>
          {t('items.photoCount', { count: photos.length })}
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.row}>
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.thumbWrapper}>
              {/* Delete button stays a sibling so tapping it never opens the viewer */}
              <Pressable
                onPress={() => setViewerIndex(index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('items.openPhoto')}
                testID={`photo-thumb-${photo.id}`}
              >
                <Image source={{ uri: photo.thumbnailUrl ?? photo.url }} style={styles.thumbnail} />
              </Pressable>
              {!readOnly && onDeletePress && (
                <IconButton
                  icon="close-circle"
                  size={20}
                  iconColor="#D97A6B"
                  onPress={() => onDeletePress(photo.id)}
                  style={styles.deleteButton}
                  testID={`photo-delete-${photo.id}`}
                  accessibilityLabel={t('items.deletePhoto')}
                />
              )}
            </View>
          ))}
          {!readOnly && canAdd && onAddPress && (
            <IconButton
              icon="plus"
              mode="outlined"
              size={24}
              onPress={onAddPress}
              style={styles.addButton}
              testID="photo-gallery-add"
            />
          )}
        </View>
      </ScrollView>
      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  counter: { color: '#6B7A8D', marginBottom: 8 },
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: 8 },
  thumbWrapper: { position: 'relative' },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    margin: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addButton: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderColor: '#C9C4BB',
    borderStyle: 'dashed',
  },
});
