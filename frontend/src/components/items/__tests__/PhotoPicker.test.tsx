import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { PhotoPicker } from '../PhotoPicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { normalizedUri } from '../../../../__mocks__/expo-image-manipulator';
import {
  deletedFiles,
  resetFileSizes,
  setFileSize,
} from '../../../../__mocks__/expoFileSystemMock';

const manipulate = ImageManipulator.manipulate as unknown as jest.Mock;

/** The manipulation context the picker opened for its n-th image (mock of expo-image-manipulator). */
function contextAt(index = 0) {
  return manipulate.mock.results[index]!.value as {
    resize: jest.Mock;
    renderAsync: jest.Mock;
    release: jest.Mock;
    image: { saveAsync: jest.Mock; release: jest.Mock };
  };
}

function renderPicker(props?: Partial<React.ComponentProps<typeof PhotoPicker>>) {
  const defaultProps = {
    onPhotoPicked: jest.fn(),
    currentPhotoCount: 0,
    ...props,
  };
  return {
    ...render(
      <PaperProvider>
        <PhotoPicker {...defaultProps} />
      </PaperProvider>,
    ),
    onPhotoPicked: defaultProps.onPhotoPicked,
  };
}

async function pickFrom(source: 'camera' | 'gallery') {
  fireEvent.press(screen.getByTestId('photo-picker-btn'));
  await waitFor(() => {
    expect(screen.getByTestId(`photo-picker-${source}`)).toBeTruthy();
  });
  fireEvent.press(screen.getByTestId(`photo-picker-${source}`));
}

function mockGalleryAsset(asset: Partial<ImagePicker.ImagePickerAsset>) {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked.jpg', width: 1200, height: 900, ...asset }],
  });
}

describe('PhotoPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFileSizes();
  });

  it('should render add photo button', () => {
    renderPicker();
    expect(screen.getByTestId('photo-picker-btn')).toBeTruthy();
  });

  it('should open dialog on button press', async () => {
    renderPicker();

    fireEvent.press(screen.getByTestId('photo-picker-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('photo-picker-dialog')).toBeTruthy();
      expect(screen.getByTestId('photo-picker-camera')).toBeTruthy();
      expect(screen.getByTestId('photo-picker-gallery')).toBeTruthy();
    });
  });

  it('should launch camera and return the photo converted to JPEG', async () => {
    const { onPhotoPicked } = renderPicker();

    await pickFrom('camera');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/camera-photo.jpg'));
    });
    expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    expect(manipulate).toHaveBeenCalledWith('file:///tmp/camera-photo.jpg');
    expect(contextAt().image.saveAsync).toHaveBeenCalledWith({
      format: SaveFormat.JPEG,
      compress: 0.8,
    });
  });

  it('should launch gallery and return the photo converted to JPEG', async () => {
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/gallery-photo.jpg'));
    });
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('should convert an iPhone HEIC photo to JPEG instead of refusing it', async () => {
    mockGalleryAsset({ uri: 'file:///tmp/IMG_0001.HEIC', mimeType: 'image/heic' });
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalledWith('file:///tmp/manipulated/IMG_0001.jpg');
    });
    expect(manipulate).toHaveBeenCalledWith('file:///tmp/IMG_0001.HEIC');
    expect(contextAt().image.saveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: SaveFormat.JPEG }),
    );
    expect(screen.queryByTestId('photo-validation-error')).toBeNull();
  });

  it('should scale a landscape photo down to 2048 px wide', async () => {
    mockGalleryAsset({ width: 4032, height: 3024 });
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });
    expect(contextAt().resize).toHaveBeenCalledWith({ width: 2048 });
  });

  it('should scale a portrait photo down to 2048 px high', async () => {
    mockGalleryAsset({ width: 3024, height: 4032 });
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });
    expect(contextAt().resize).toHaveBeenCalledWith({ height: 2048 });
  });

  it('should never enlarge a photo smaller than the limit', async () => {
    mockGalleryAsset({ width: 1600, height: 1200 });
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });
    expect(contextAt().resize).not.toHaveBeenCalled();
  });

  it('should use the maxDimension prop when given (avatar)', async () => {
    mockGalleryAsset({ width: 4032, height: 3024 });
    const { onPhotoPicked } = renderPicker({ maxDimension: 1024 });

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });
    expect(contextAt().resize).toHaveBeenCalledWith({ width: 1024 });
  });

  it('should accept a photo heavier than 5 MB, since the conversion shrinks it', async () => {
    mockGalleryAsset({ fileSize: 6 * 1024 * 1024, width: 4032, height: 3024 });
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalledWith('file:///tmp/manipulated/picked.jpg');
    });
    expect(screen.queryByTestId('photo-validation-error')).toBeNull();
  });

  it('should release the native image memory after the conversion', async () => {
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });
    expect(contextAt().release).toHaveBeenCalled();
    expect(contextAt().image.release).toHaveBeenCalled();
  });

  it('should show an error and upload nothing when the photo cannot be converted', async () => {
    manipulate.mockImplementationOnce(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn().mockRejectedValue(new Error('unsupported image')),
      release: jest.fn(),
    }));
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');

    await waitFor(() => {
      expect(screen.getByTestId('photo-validation-error')).toBeTruthy();
    });
    expect(onPhotoPicked).not.toHaveBeenCalled();
  });

  it('should be disabled when max photos reached', () => {
    renderPicker({ currentPhotoCount: 5 });

    const btn = screen.getByTestId('photo-picker-btn');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  it('should not call onPhotoPicked when camera is canceled', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    const { onPhotoPicked } = renderPicker();

    await pickFrom('camera');

    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });

    expect(manipulate).not.toHaveBeenCalled();
    expect(onPhotoPicked).not.toHaveBeenCalled();
  });

  it('should clear the error after a successful pick', async () => {
    manipulate.mockImplementationOnce(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn().mockRejectedValue(new Error('unsupported image')),
      release: jest.fn(),
    }));
    const { onPhotoPicked } = renderPicker();

    await pickFrom('gallery');
    await waitFor(() => {
      expect(screen.getByTestId('photo-validation-error')).toBeTruthy();
    });

    await pickFrom('gallery');
    await waitFor(() => {
      expect(onPhotoPicked).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('photo-validation-error')).toBeNull();
  });

  describe('PNG photos (transparency, e.g. an iPhone subject cut-out)', () => {
    const MB = 1024 * 1024;

    it('should keep a PNG as PNG, so its transparent background does not turn black', async () => {
      mockGalleryAsset({ uri: 'file:///tmp/cutout.png', mimeType: 'image/png' });
      const { onPhotoPicked } = renderPicker();

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/cutout.png', 'png'));
      });
      expect(contextAt().image.saveAsync).toHaveBeenCalledTimes(1);
      expect(contextAt().image.saveAsync).toHaveBeenCalledWith({ format: SaveFormat.PNG });
    });

    it('should recognise a PNG from its extension when the picker gives no MIME type', async () => {
      mockGalleryAsset({ uri: 'file:///tmp/screenshot.PNG', mimeType: undefined });
      const { onPhotoPicked } = renderPicker();

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalledWith(
          normalizedUri('file:///tmp/screenshot.PNG', 'png'),
        );
      });
    });

    it('should still scale a large PNG down to the maximum dimension', async () => {
      mockGalleryAsset({ uri: 'file:///tmp/cutout.png', mimeType: 'image/png', width: 4000 });
      const { onPhotoPicked } = renderPicker();

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalled();
      });
      expect(contextAt().resize).toHaveBeenCalledWith({ width: 2048 });
    });

    it('should fall back to JPEG when the PNG is over the 5 MB item photo limit, and delete the PNG', async () => {
      const pngUri = normalizedUri('file:///tmp/cutout.png', 'png');
      setFileSize(pngUri, 6 * MB);
      mockGalleryAsset({ uri: 'file:///tmp/cutout.png', mimeType: 'image/png' });
      const { onPhotoPicked } = renderPicker();

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/cutout.png', 'jpg'));
      });
      expect(contextAt().image.saveAsync).toHaveBeenLastCalledWith({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });
      expect(deletedFiles).toHaveBeenCalledWith(pngUri);
    });

    it('should use the maxBytes prop as the PNG limit', async () => {
      setFileSize(normalizedUri('file:///tmp/cutout.png', 'png'), 3 * MB);
      mockGalleryAsset({ uri: 'file:///tmp/cutout.png', mimeType: 'image/png' });
      const { onPhotoPicked } = renderPicker({ maxBytes: 2 * MB });

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/cutout.png', 'jpg'));
      });
    });

    it('should fall back to JPEG when the PNG size cannot be read', async () => {
      setFileSize(normalizedUri('file:///tmp/cutout.png', 'png'), 0);
      mockGalleryAsset({ uri: 'file:///tmp/cutout.png', mimeType: 'image/png' });
      const { onPhotoPicked } = renderPicker();

      await pickFrom('gallery');

      await waitFor(() => {
        expect(onPhotoPicked).toHaveBeenCalledWith(normalizedUri('file:///tmp/cutout.png', 'jpg'));
      });
    });
  });
});
