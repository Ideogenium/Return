import { useContext, useEffect, useState } from 'react';
import {
  View,
  Image,
  FlatList,
  Modal,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Photo } from '../../types/api.types';

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

export function PhotoViewer({ photos, initialIndex, visible, onClose }: PhotoViewerProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // Read the context directly: unlike useSafeAreaInsets it does not throw without a provider
  const insets = useContext(SafeAreaInsetsContext);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Reset on every opening so the counter matches the list's initialScrollIndex
  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  if (!visible || photos.length === 0) return null;

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(Math.min(Math.max(index, 0), photos.length - 1));
  };

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="photo-viewer"
    >
      <View style={styles.container}>
        <FlatList
          testID="photo-viewer-list"
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(photo) => photo.id}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item }) => (
            <View style={[styles.page, { width }]}>
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                resizeMode="contain"
                testID={`photo-viewer-image-${item.id}`}
              />
            </View>
          )}
        />
        <View style={[styles.header, { top: (insets?.top ?? 0) + 8 }]} pointerEvents="box-none">
          <Text variant="titleMedium" style={styles.counter} testID="photo-viewer-counter">
            {t('items.photoViewerCounter', { current: currentIndex + 1, total: photos.length })}
          </Text>
          <IconButton
            icon="close"
            size={28}
            iconColor="#FFFFFF"
            onPress={onClose}
            testID="photo-viewer-close"
            accessibilityLabel={t('items.photoViewerClose')}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  counter: { color: '#FFFFFF' },
});
