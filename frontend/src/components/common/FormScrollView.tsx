import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type HostInstance,
  type KeyboardMetrics,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

/** Space kept between the bottom of the focused field and the top of the keyboard. */
const FIELD_KEYBOARD_MARGIN = 16;

/**
 * Bottom padding that keeps an Android form clear of the keyboard.
 *
 * The app runs edge-to-edge (Expo SDK 54): the window is no longer resized for the keyboard
 * (`adjustResize` has no effect), so the form must shrink itself by the part the keyboard
 * covers. The overlap is measured in window coordinates, which also accounts for a header
 * above the form or a tab bar below it. iOS needs none of this: the scroll view insets
 * itself (`automaticallyAdjustKeyboardInsets`).
 */
function useAndroidKeyboardOverlap(area: React.RefObject<View | null>, enabled: boolean): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return undefined;
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      area.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, y + height - endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [area, enabled]);

  return overlap;
}

/**
 * Keeps the bottom of the focused field visible: above the keyboard, and above the bottom of
 * the scroll view itself when that one ends higher (a dialog already moved above the keyboard).
 * Neither platform does it on its own past the moment a field receives the focus, so it runs:
 * - when the content grows (a multiline field gaining a line);
 * - when the scroll view's own frame changes (a dialog shrinking as it moves above the keyboard);
 * - once the keyboard has opened, the layout having settled.
 * Only a focused field inside this scroll view is considered.
 */
function useKeepFocusedFieldVisible(scroll: React.RefObject<ScrollView | null>) {
  const offsetY = useRef(0);

  const trackOffset = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const keepFocusedFieldVisible = useCallback(
    (shownKeyboard?: KeyboardMetrics) => {
      const keyboard = shownKeyboard ?? (Keyboard.isVisible() ? Keyboard.metrics() : undefined);
      const input = TextInput.State.currentlyFocusedInput();
      const scrollView = scroll.current;
      if (!keyboard || !input || !scrollView) return;
      // At runtime the ScrollView ref is its native host view, which the class type does not show.
      const scrollHost = scrollView as unknown as HostInstance;

      // Measuring against this scroll view fails when the focused field belongs to another view.
      input.measureLayout(
        scrollHost,
        () => {
          scrollHost.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
            const visibleBottom = Math.min(keyboard.screenY, scrollTop + scrollHeight);
            input.measureInWindow((_x, y, _width, height) => {
              const hidden = y + height + FIELD_KEYBOARD_MARGIN - visibleBottom;
              if (hidden > 0) scrollView.scrollTo({ y: offsetY.current + hidden, animated: true });
            });
          });
        },
        () => undefined,
      );
    },
    [scroll],
  );

  useEffect(() => {
    // The event's coordinates: Keyboard.metrics() may not be updated yet when it fires.
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) =>
      keepFocusedFieldVisible(endCoordinates),
    );
    return () => show.remove();
  }, [keepFocusedFieldVisible]);

  return { trackOffset, keepFocusedFieldVisible };
}

/**
 * ScrollView for any screen or dialog holding text fields:
 * - a tap on another field (or a button) works at once, instead of only closing the keyboard;
 * - the focused field stays above the keyboard, also while a multiline field grows, and the
 *   end of the form can be scrolled to;
 * - on iOS, dragging the form down closes the keyboard; on Android, scrolling keeps it open
 *   (Android has no interactive dismissal, and closing at the first scroll hid the end of
 *   long fields).
 */
export interface FormScrollViewProps extends ScrollViewProps {
  /**
   * Compensates for the keyboard (default true): iOS insets the scroll view, Android pads it
   * by the part the keyboard covers. Pass false when a parent already moves the whole view
   * above the keyboard (FormDialog): the insets would be computed on the position before the
   * move and stay frozen, leaving an empty gap or pushing the field out of view. The growing
   * field is still kept in view either way.
   */
  keyboardAvoidance?: boolean;
}

export const FormScrollView = forwardRef<ScrollView, FormScrollViewProps>(function FormScrollView(
  {
    testID,
    onScroll,
    onContentSizeChange,
    onLayout,
    scrollEventThrottle = 16,
    keyboardAvoidance = true,
    ...props
  },
  ref,
) {
  const area = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scroll.current as ScrollView);
  const overlap = useAndroidKeyboardOverlap(area, keyboardAvoidance);
  const { trackOffset, keepFocusedFieldVisible } = useKeepFocusedFieldVisible(scroll);

  const scrollView = (
    <ScrollView
      {...props}
      ref={scroll}
      testID={testID}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      automaticallyAdjustKeyboardInsets={keyboardAvoidance}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={(event) => {
        trackOffset(event);
        onScroll?.(event);
      }}
      onContentSizeChange={(width, height) => {
        keepFocusedFieldVisible();
        onContentSizeChange?.(width, height);
      }}
      onLayout={(event) => {
        keepFocusedFieldVisible();
        onLayout?.(event);
      }}
    />
  );

  if (Platform.OS !== 'android' || !keyboardAvoidance) return scrollView;

  return (
    <View
      ref={area}
      style={[styles.area, { paddingBottom: overlap }]}
      testID={testID ? `${testID}-keyboard-area` : undefined}
    >
      {scrollView}
    </View>
  );
});

const styles = StyleSheet.create({
  // Takes the place the ScrollView would take: fills a screen, sizes to content in a dialog.
  area: { flexGrow: 1, flexShrink: 1 },
});
