import { render, screen, fireEvent } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { PhotoViewer } from '../PhotoViewer';
import type { Photo } from '../../../types/api.types';

const photos: Photo[] = [1, 2, 3].map((n) => ({
  id: `photo-${n}`,
  url: `https://storage.return.app/items/photo${n}.jpg`,
  thumbnailUrl: `https://storage.return.app/items/photo${n}_thumb.jpg`,
  uploadedAt: '2026-02-20T14:00:00Z',
}));

function renderViewer(props?: Partial<React.ComponentProps<typeof PhotoViewer>>) {
  const onClose = jest.fn();
  const utils = render(
    <PaperProvider>
      <PhotoViewer photos={photos} initialIndex={0} visible onClose={onClose} {...props} />
    </PaperProvider>,
  );
  return { ...utils, onClose };
}

describe('PhotoViewer', () => {
  it('should render the viewer when visible with photos', () => {
    renderViewer();
    expect(screen.getByTestId('photo-viewer')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-list')).toBeTruthy();
  });

  it('should display the full-size url instead of the thumbnail', () => {
    renderViewer();
    const image = screen.getByTestId('photo-viewer-image-photo-1');
    expect(image.props.source).toEqual({ uri: photos[0]?.url });
  });

  it('should render a horizontal paged list', () => {
    renderViewer();
    const list = screen.getByTestId('photo-viewer-list');
    expect(list.props.horizontal).toBe(true);
    expect(list.props.pagingEnabled).toBe(true);
  });

  it('should label the rendered image with its position', () => {
    // Only the visible page is rendered (initialNumToRender=1), so start on the 2nd photo
    renderViewer({ initialIndex: 1 });
    const label = screen.getByTestId('photo-viewer-image-photo-2').props.accessibilityLabel;
    expect(label).toMatch(/^Photo 2 (sur|of) 3$/);
  });

  it('should announce photo changes through a polite live region on the counter', () => {
    renderViewer();
    expect(screen.getByTestId('photo-viewer-counter').props.accessibilityLiveRegion).toBe('polite');
  });

  it('should limit rendered pages to keep memory low', () => {
    renderViewer();
    const list = screen.getByTestId('photo-viewer-list');
    expect(list.props.initialNumToRender).toBe(1);
    expect(list.props.windowSize).toBe(3);
  });

  it('should start on the initial index', () => {
    renderViewer({ initialIndex: 1 });
    expect(screen.getByTestId('photo-viewer-list').props.initialScrollIndex).toBe(1);
    expect(screen.getByTestId('photo-viewer-counter')).toHaveTextContent('2 / 3');
  });

  it('should show the counter for the first photo', () => {
    renderViewer();
    expect(screen.getByTestId('photo-viewer-counter')).toHaveTextContent('1 / 3');
  });

  it('should update the counter when scrolling to another photo', () => {
    renderViewer();
    const { width } = Dimensions.get('window');

    fireEvent(screen.getByTestId('photo-viewer-list'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: width * 2, y: 0 } },
    });

    expect(screen.getByTestId('photo-viewer-counter')).toHaveTextContent('3 / 3');
  });

  it('should call onClose when pressing the close button', () => {
    const { onClose } = renderViewer();
    fireEvent.press(screen.getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should expose an accessibility label on the close button', () => {
    renderViewer();
    const label = screen.getByTestId('photo-viewer-close').props.accessibilityLabel;
    expect(typeof label).toBe('string');
    expect(label).not.toBe('');
    // Must be a translated string, not the raw i18n key
    expect(label).not.toBe('items.photoViewerClose');
  });

  it('should call onClose on Android back button (onRequestClose)', () => {
    const { onClose } = renderViewer();
    fireEvent(screen.getByTestId('photo-viewer'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render nothing when not visible', () => {
    renderViewer({ visible: false });
    expect(screen.queryByTestId('photo-viewer-list')).toBeNull();
    expect(screen.queryByTestId('photo-viewer-counter')).toBeNull();
    expect(screen.queryByTestId('photo-viewer-close')).toBeNull();
  });

  it('should render nothing when photos is empty', () => {
    renderViewer({ photos: [] });
    expect(screen.queryByTestId('photo-viewer-list')).toBeNull();
    expect(screen.queryByTestId('photo-viewer-counter')).toBeNull();
  });
});
