import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type KeyboardMetrics,
} from 'react-native';
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

    it('lets a tap reach another field and keeps the keyboard open while scrolling', () => {
      captureKeyboardListeners();
      renderForm();

      const scroll = screen.getByTestId('form');
      expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
      // 'on-drag' closed the keyboard at the first scroll: the end of a long field could not be reached.
      expect(scroll.props.keyboardDismissMode).toBe('none');
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

  describe('keeps a growing multiline field above the keyboard', () => {
    type FakeInput = {
      measureLayout: jest.Mock;
      measureInWindow: jest.Mock;
    };

    /** A focused field whose window frame is (y, height); `inside` says whether it belongs to the form. */
    function focusField({
      y,
      height,
      inside = true,
    }: {
      y: number;
      height: number;
      inside?: boolean;
    }) {
      const input: FakeInput = {
        measureLayout: jest.fn((_relativeTo, onSuccess: () => void, onFail: () => void) =>
          inside ? onSuccess() : onFail(),
        ),
        measureInWindow: jest.fn((callback: (x: number, y: number, w: number, h: number) => void) =>
          callback(0, y, 400, height),
        ),
      };
      jest
        .spyOn(TextInput.State, 'currentlyFocusedInput')
        .mockReturnValue(
          input as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>,
        );
      return input;
    }

    function keyboardOpenAt(screenY: number | null) {
      jest.spyOn(Keyboard, 'isVisible').mockReturnValue(screenY !== null);
      jest
        .spyOn(Keyboard, 'metrics')
        .mockReturnValue(
          screenY === null
            ? undefined
            : ({ screenX: 0, screenY, width: 400, height: 300 } as KeyboardMetrics),
        );
    }

    /** The scroll view occupies the window from `top` to `bottom` (default: below the keyboard). */
    function renderGrowingForm({ top = 0, bottom = 2000 }: { top?: number; bottom?: number } = {}) {
      const ref = createRef<ScrollView>();
      const onContentSizeChange = jest.fn();
      render(
        <FormScrollView ref={ref} testID="form" onContentSizeChange={onContentSizeChange}>
          <Text>field</Text>
        </FormScrollView>,
      );
      jest
        .spyOn(ref.current as unknown as { measureInWindow: MeasureInWindow }, 'measureInWindow')
        .mockImplementation((callback) => callback(0, top, 400, bottom - top));
      // The mocked ScrollView shares one scrollTo across instances: clear its earlier calls.
      const scrollTo = jest
        .spyOn(ref.current as ScrollView, 'scrollTo')
        .mockImplementation(() => {});
      scrollTo.mockClear();
      const grow = () => fireEvent(screen.getByTestId('form'), 'contentSizeChange', 400, 1200);
      return { ref, scrollTo, grow, onContentSizeChange };
    }

    describe.each(['ios', 'android'] as const)('on %s', (os) => {
      beforeEach(() => {
        jest.replaceProperty(Platform, 'OS', os);
        captureKeyboardListeners();
      });

      it('scrolls by the part of the focused field the keyboard hides', () => {
        // Keyboard top at 600; field bottom at 500 + 120 = 620, plus a 16 px margin: 36 px hidden.
        keyboardOpenAt(600);
        focusField({ y: 500, height: 120 });
        const { scrollTo, grow } = renderGrowingForm();
        fireEvent.scroll(screen.getByTestId('form'), {
          nativeEvent: { contentOffset: { x: 0, y: 50 } },
        });

        grow();

        expect(scrollTo).toHaveBeenCalledWith({ y: 50 + 36, animated: true });
      });

      it('scrolls a field hidden below the bottom of a scroll view that sits above the keyboard', () => {
        // A dialog moved above the keyboard: its scroll area ends at 450, the keyboard starts at 600.
        // Field bottom at 400 + 80 = 480, plus the 16 px margin: 46 px below the scroll area.
        keyboardOpenAt(600);
        focusField({ y: 400, height: 80 });
        const { scrollTo, grow } = renderGrowingForm({ top: 150, bottom: 450 });

        grow();

        expect(scrollTo).toHaveBeenCalledWith({ y: 46, animated: true });
      });

      it('does not scroll when the field is still above the keyboard', () => {
        keyboardOpenAt(600);
        focusField({ y: 300, height: 100 });
        const { scrollTo, grow } = renderGrowingForm();

        grow();

        expect(scrollTo).not.toHaveBeenCalled();
      });

      it('ignores a focused field that is not in this form', () => {
        keyboardOpenAt(600);
        const input = focusField({ y: 500, height: 120, inside: false });
        const { scrollTo, grow } = renderGrowingForm();

        grow();

        expect(input.measureInWindow).not.toHaveBeenCalled();
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it('does nothing while the keyboard is closed', () => {
        keyboardOpenAt(null);
        const input = focusField({ y: 500, height: 120 });
        const { scrollTo, grow } = renderGrowingForm();

        grow();

        expect(input.measureLayout).not.toHaveBeenCalled();
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it('does nothing when no field has the focus', () => {
        keyboardOpenAt(600);
        jest
          .spyOn(TextInput.State, 'currentlyFocusedInput')
          .mockReturnValue(
            null as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>,
          );
        const { scrollTo, grow } = renderGrowingForm();

        grow();

        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("still calls the caller's onContentSizeChange", () => {
        keyboardOpenAt(null);
        const { grow, onContentSizeChange } = renderGrowingForm();

        grow();

        expect(onContentSizeChange).toHaveBeenCalledWith(400, 1200);
      });
    });
  });

  describe('with keyboardAvoidance={false} (a parent already moves above the keyboard)', () => {
    function renderUnavoidingForm() {
      return render(
        <FormScrollView testID="form" keyboardAvoidance={false}>
          <Text>field</Text>
        </FormScrollView>,
      );
    }

    it('does not inset the scroll view for the keyboard on iOS', () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      renderUnavoidingForm();

      const scroll = screen.getByTestId('form');
      expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
      expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('neither listens to the keyboard nor pads the form on Android', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const addListener = jest.spyOn(Keyboard, 'addListener');
      renderUnavoidingForm();

      expect(addListener).not.toHaveBeenCalled();
      expect(screen.queryByTestId('form-keyboard-area')).toBeNull();
      expect(screen.getByTestId('form').props.keyboardDismissMode).toBe('none');
    });
  });
});
