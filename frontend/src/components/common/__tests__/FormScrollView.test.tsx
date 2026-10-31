import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet, Text, View, type KeyboardEvent } from 'react-native';
import { FormScrollView } from '../FormScrollView';

type KeyboardHandler = (event: KeyboardEvent) => void;

/** Captures the Keyboard listeners the component registers, to fire them by hand. */
function captureKeyboardListeners() {
  const handlers: Partial<Record<string, KeyboardHandler>> = {};
  const remove = jest.fn();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    eventName: string,
    handler: KeyboardHandler,
  ) => {
    handlers[eventName] = handler;
    return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
  }) as typeof Keyboard.addListener);
  const fire = (eventName: string, event: KeyboardEvent) => act(() => handlers[eventName]?.(event));
  return { fire, remove };
}

function keyboardShownAt(screenY: number): KeyboardEvent {
  return {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: { screenX: 0, screenY, width: 400, height: 300 },
  } as KeyboardEvent;
}

type MeasureInWindow = (callback: (x: number, y: number, w: number, h: number) => void) => void;

const styles = StyleSheet.create({ content: { padding: 16 } });

function renderForm() {
  // The form's container occupies the window from y = 100 to y = 900.
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: MeasureInWindow }, 'measureInWindow')
    .mockImplementation((callback) => callback(0, 100, 400, 800));
  return render(
    <FormScrollView testID="form" contentContainerStyle={styles.content}>
      <Text>field</Text>
    </FormScrollView>,
  );
}

describe('FormScrollView', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('on iOS', () => {
    beforeEach(() => jest.replaceProperty(Platform, 'OS', 'ios'));

    it('lets a tap reach another field while the keyboard is open', () => {
      renderForm();

      expect(screen.getByTestId('form').props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('keeps the focused field above the keyboard and lets a drag dismiss it', () => {
      renderForm();

      const scroll = screen.getByTestId('form');
      expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
      expect(scroll.props.keyboardDismissMode).toBe('interactive');
    });

    it("passes the caller's props and children through", () => {
      renderForm();

      expect(StyleSheet.flatten(screen.getByTestId('form').props.contentContainerStyle)).toEqual({
        padding: 16,
      });
      expect(screen.getByText('field')).toBeTruthy();
    });

    it('does not listen to the keyboard: iOS insets the scroll view itself', () => {
      const addListener = jest.spyOn(Keyboard, 'addListener');
      renderForm();

      expect(addListener).not.toHaveBeenCalled();
    });
  });

  describe('on Android (edge-to-edge: the window is not resized for the keyboard)', () => {
    beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));

    it('lets a tap reach another field and dismisses the keyboard on drag', () => {
      captureKeyboardListeners();
      renderForm();

      const scroll = screen.getByTestId('form');
      expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
      expect(scroll.props.keyboardDismissMode).toBe('on-drag');
    });

    it('shrinks the form by the part the keyboard covers, then restores it', () => {
      const { fire } = captureKeyboardListeners();
      renderForm();
      const container = () =>
        StyleSheet.flatten(screen.getByTestId('form-keyboard-area').props.style);

      // Keyboard top at y = 600: it covers 900 - 600 = 300 px of the form.
      fire('keyboardDidShow', keyboardShownAt(600));
      expect(container().paddingBottom).toBe(300);

      fire('keyboardDidHide', keyboardShownAt(1000));
      expect(container().paddingBottom).toBe(0);
    });

    it('does not pad a form the keyboard does not reach', () => {
      const { fire } = captureKeyboardListeners();
      renderForm();

      fire('keyboardDidShow', keyboardShownAt(950));

      expect(
        StyleSheet.flatten(screen.getByTestId('form-keyboard-area').props.style).paddingBottom,
      ).toBe(0);
    });

    it('stops listening to the keyboard when unmounted', () => {
      const { remove } = captureKeyboardListeners();
      const { unmount } = renderForm();

      unmount();

      expect(remove).toHaveBeenCalledTimes(2);
    });
  });
});
