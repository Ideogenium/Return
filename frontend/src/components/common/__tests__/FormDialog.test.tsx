import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, Keyboard, Platform, StyleSheet, Text, type KeyboardEvent } from 'react-native';
import { Button, PaperProvider, Portal } from 'react-native-paper';
import { FormDialog } from '../FormDialog';

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
  const fire = (eventName: string, height: number) =>
    act(() =>
      handlers[eventName]?.({
        duration: 0,
        easing: 'keyboard',
        endCoordinates: { screenX: 0, screenY: 1000 - height, width: 390, height },
      } as KeyboardEvent),
    );
  return { fire, remove, handlers };
}

function renderDialog(props: Partial<React.ComponentProps<typeof FormDialog>> = {}) {
  const onDismiss = jest.fn();
  render(
    <PaperProvider>
      <Portal>
        <FormDialog
          visible
          onDismiss={onDismiss}
          title="Contest"
          actions={<Button testID="action-btn">OK</Button>}
          testID="dialog"
          scrollTestID="dialog-scroll"
          {...props}
        >
          <Text>reason</Text>
        </FormDialog>
      </Portal>
    </PaperProvider>,
  );
  return { onDismiss };
}

/** Dialog surface style. On iOS, Paper moves the margins to an outer shadow layer. */
const surfaceStyle = () => ({
  ...StyleSheet.flatten(screen.queryByTestId('dialog-surface-outer-layer')?.props.style),
  ...StyleSheet.flatten(screen.getByTestId('dialog-surface').props.style),
});
const tapBackdrop = () => fireEvent.press(screen.getByTestId('dialog-backdrop'));

describe('FormDialog', () => {
  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ['ios', 'keyboardWillShow', 'keyboardWillHide'],
    ['android', 'keyboardDidShow', 'keyboardDidHide'],
  ])('on %s', (os, showEvent, hideEvent) => {
    beforeEach(() => jest.replaceProperty(Platform, 'OS', os as typeof Platform.OS));

    it('renders the title, the content in a FormScrollView and the actions', () => {
      captureKeyboardListeners();
      renderDialog();

      expect(screen.getByText('Contest')).toBeTruthy();
      expect(screen.getByTestId('dialog-scroll').props.keyboardShouldPersistTaps).toBe('handled');
      expect(screen.getByText('reason')).toBeTruthy();
      expect(screen.getByTestId('action-btn')).toBeTruthy();
    });

    it('closes on a backdrop tap while the keyboard is closed', () => {
      captureKeyboardListeners();
      const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
      const { onDismiss } = renderDialog();

      tapBackdrop();

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(dismissKeyboard).not.toHaveBeenCalled();
    });

    it('only closes the keyboard on a backdrop tap while it is open', () => {
      const { fire } = captureKeyboardListeners();
      const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      const { onDismiss } = renderDialog();

      fire(showEvent, 300);
      tapBackdrop();

      expect(dismissKeyboard).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();

      fire(hideEvent, 0);
      tapBackdrop();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('stays open on a backdrop tap while it holds unsaved input', () => {
      captureKeyboardListeners();
      const { onDismiss } = renderDialog({ hasUnsavedInput: true });

      tapBackdrop();

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('sits above the keyboard and fits in the space left, then goes back to normal', () => {
      const { fire } = captureKeyboardListeners();
      renderDialog();
      const normal = surfaceStyle();

      // No safe-area inset in tests: the keyboard covers 300 of the window.
      const windowHeight = Dimensions.get('window').height;
      fire(showEvent, 300);
      const lifted = surfaceStyle();
      expect(lifted.marginBottom).toBe(300 + 16);
      expect(lifted.marginTop).toBe(16);
      expect(lifted.maxHeight).toBe(windowHeight - 300 - 2 * 16);

      fire(hideEvent, 0);
      expect(surfaceStyle()).toEqual(normal);
    });

    it('stops listening to the keyboard when unmounted', () => {
      const { remove } = captureKeyboardListeners();
      renderDialog();
      const registered = jest.mocked(Keyboard.addListener).mock.calls.length;

      screen.unmount();

      expect(registered).toBeGreaterThanOrEqual(2);
      expect(remove).toHaveBeenCalledTimes(registered);
    });
  });
});
