import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';

/**
 * Bottom padding that keeps an Android form clear of the keyboard.
 *
 * The app runs edge-to-edge (Expo SDK 54): the window is no longer resized for the keyboard
 * (`adjustResize` has no effect), so the form must shrink itself by the part the keyboard
 * covers. The overlap is measured in window coordinates, which also accounts for a header
 * above the form or a tab bar below it. iOS needs none of this: the scroll view insets
 * itself (`automaticallyAdjustKeyboardInsets`).
 */
function useAndroidKeyboardOverlap(area: React.RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
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
  }, [area]);

  return overlap;
}

/**
 * ScrollView for any screen or dialog holding text fields:
 * - a tap on another field (or a button) works at once, instead of only closing the keyboard;
 * - the focused field stays above the keyboard and the end of the form can be scrolled to;
 * - dragging the form dismisses the keyboard.
 */
export const FormScrollView = forwardRef<ScrollView, ScrollViewProps>(function FormScrollView(
  { testID, ...props },
  ref,
) {
  const area = useRef<View>(null);
  const overlap = useAndroidKeyboardOverlap(area);

  const scrollView = (
    <ScrollView
      {...props}
      ref={ref}
      testID={testID}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
    />
  );

  if (Platform.OS !== 'android') return scrollView;

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
