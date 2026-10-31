import { render, screen, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { PhotoGallery } from '../PhotoGallery';
import type { Photo } from '../../../types/api.types';

const photos: Photo[] = [1, 2, 3].map((n) => ({
  id: `photo-${n}`,
  url: `https://storage.return.app/items/photo${n}.jpg`,
  thumbnailUrl: `https://storage.return.app/items/photo${n}_thumb.jpg`,
  uploadedAt: '2026-02-20T14:00:00Z',
}));

function renderGallery(props?: Partial<React.ComponentProps<typeof PhotoGallery>>) {
  return render(
    <PaperProvider>
      <PhotoGallery photos={photos} {...props} />
    </PaperProvider>,
  );
}

describe('PhotoGallery', () => {
  it('should not show the viewer initially', () => {
    renderGallery();
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  it('should make thumbnails pressable image buttons', () => {
    renderGallery();
    const thumb = screen.getByTestId('photo-thumb-photo-2');
    expect(['imagebutton', 'button']).toContain(thumb.props.accessibilityRole);
    expect(typeof thumb.props.accessibilityLabel).toBe('string');
    expect(thumb.props.accessibilityLabel).not.toBe('');
  });

  it('should open the viewer when tapping a thumbnail', () => {
    renderGallery();
    fireEvent.press(screen.getByTestId('photo-thumb-photo-1'));
    expect(screen.getByTestId('photo-viewer')).toBeTruthy();
  });

  it('should open the viewer on the tapped photo', () => {
    renderGallery();
    fireEvent.press(screen.getByTestId('photo-thumb-photo-3'));
    expect(screen.getByTestId('photo-viewer-counter')).toHaveTextContent('3 / 3');
    expect(screen.getByTestId('photo-viewer-list').props.initialScrollIndex).toBe(2);
  });

  it('should close the viewer when pressing its close button', () => {
    renderGallery();
    fireEvent.press(screen.getByTestId('photo-thumb-photo-2'));
    fireEvent.press(screen.getByTestId('photo-viewer-close'));
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  describe('read-only mode (readOnly)', () => {
    it('should not render delete buttons', () => {
      renderGallery({ readOnly: true });
      expect(screen.queryByTestId('photo-delete-photo-1')).toBeNull();
    });

    it('should not render the add button', () => {
      renderGallery({ readOnly: true });
      expect(screen.queryByTestId('photo-gallery-add')).toBeNull();
    });

    it('should not render the x/5 quota counter', () => {
      renderGallery({ readOnly: true });
      // items.photoCount is "{{count}}/5 photos" in both FR and EN
      expect(screen.queryByText(/\/5/)).toBeNull();
    });

    it('should still open the viewer', () => {
      renderGallery({ readOnly: true });
      fireEvent.press(screen.getByTestId('photo-thumb-photo-1'));
      expect(screen.getByTestId('photo-viewer')).toBeTruthy();
    });

    it('should hide delete and add buttons even when callbacks are provided', () => {
      renderGallery({ readOnly: true, onDeletePress: jest.fn(), onAddPress: jest.fn() });
      expect(screen.queryByTestId('photo-delete-photo-1')).toBeNull();
      expect(screen.queryByTestId('photo-gallery-add')).toBeNull();
      expect(screen.queryByText('3/5 photos')).toBeNull();
    });
  });

  describe('default mode (no readOnly)', () => {
    it('should show the x/5 quota counter even without callbacks', () => {
      renderGallery();
      expect(screen.getByText('3/5 photos')).toBeTruthy();
    });
  });

  describe('owner mode', () => {
    it('should show the x/5 quota counter when onDeletePress is provided', () => {
      renderGallery({ onDeletePress: jest.fn() });
      expect(screen.getByText('3/5 photos')).toBeTruthy();
    });

    it('should show the x/5 quota counter when onAddPress is provided', () => {
      renderGallery({ onAddPress: jest.fn() });
      expect(screen.getByText('3/5 photos')).toBeTruthy();
    });

    it('should call onDeletePress without opening the viewer', () => {
      const onDeletePress = jest.fn();
      renderGallery({ onDeletePress });

      fireEvent.press(screen.getByTestId('photo-delete-photo-2'));

      expect(onDeletePress).toHaveBeenCalledWith('photo-2');
      expect(screen.queryByTestId('photo-viewer')).toBeNull();
    });

    it('should call onAddPress without opening the viewer', () => {
      const onAddPress = jest.fn();
      renderGallery({ onAddPress, photos: photos.slice(0, 2) });

      fireEvent.press(screen.getByTestId('photo-gallery-add'));

      expect(onAddPress).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('photo-viewer')).toBeNull();
    });
  });
});
