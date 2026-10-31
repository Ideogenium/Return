import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Dialog } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormScrollView } from './FormScrollView';

/** Space kept between the dialog and the keyboard, and above the dialog. */
const KEYBOARD_GAP = 16;

/**
 * Height of the keyboard while it is open, 0 otherwise. iOS announces the keyboard before
 * it moves (`Will` events), so the dialog moves with it; Android only sends `Did` events.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const [showEvent, hideEvent] =
      Platform.OS === 'ios'
        ? (['keyboardWillShow', 'keyboardWillHide'] as const)
        : (['keyboardDidShow', 'keyboardDidHide'] as const);
    const show = Keyboard.addListener(showEvent, ({ endCoordinates }) =>
      setHeight(endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

interface FormDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** Buttons of the dialog: they stay visible above the keyboard. */
  actions: ReactNode;
  /** Content of the dialog, scrolled by a FormScrollView. */
  children: ReactNode;
  /** True while the dialog holds typed text: then only its own buttons close it. */
  hasUnsavedInput?: boolean;
  testID?: string;
  scrollTestID?: string;
}

/**
 * Dialog for any form with text fields. A centered Paper dialog ignores the keyboard, which
 * then covers its field and its buttons. This one:
 * - sits above the keyboard and shrinks to the space left, its content scrolling;
 * - closes only the keyboard on a backdrop tap while the keyboard is open, so a tap meant
 *   to hide the keyboard never discards the dialog and what was typed in it.
 */
export function FormDialog({
  visible,
  onDismiss,
  title,
  actions,
  children,
  hasUnsavedInput = false,
  testID,
  scrollTestID,
}: FormDialogProps) {
  const keyboardHeight = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();

  // The dialog is centered in a wrapper inset by the safe area. On iOS the keyboard height
  // includes the bottom inset, which the wrapper already leaves out; on Android React Native
  // reports the keyboard height without the system bars (ReactRootView), so it is used as is.
  const covered = Platform.OS === 'ios' ? Math.max(0, keyboardHeight - bottom) : keyboardHeight;
  const aboveKeyboard =
    covered > 0
      ? {
          marginTop: KEYBOARD_GAP,
          marginBottom: covered + KEYBOARD_GAP,
          maxHeight: windowHeight - top - bottom - covered - 2 * KEYBOARD_GAP,
        }
      : undefined;

  const handleDismiss = () => {
    if (keyboardHeight > 0) {
      Keyboard.dismiss();
      return;
    }
    if (!hasUnsavedInput) onDismiss();
  };

  return (
    <Dialog visible={visible} onDismiss={handleDismiss} style={aboveKeyboard} testID={testID}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.ScrollArea style={styles.scrollArea}>
        {/* The dialog already moves above the keyboard: its scroll view must not avoid it too. */}
        <FormScrollView testID={scrollTestID} keyboardAvoidance={false}>
          <View style={styles.content}>{children}</View>
        </FormScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>{actions}</Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  // The scroll area spans the dialog, the content keeps the padding. It shrinks first when
  // the keyboard leaves less room, so the title and the buttons stay visible.
  scrollArea: { maxHeight: 420, paddingHorizontal: 0 },
  content: { paddingHorizontal: 24, paddingVertical: 8 },
});
