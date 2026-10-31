import { act, fireEvent, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

/** React Native's jest mock of TextInput shares one `focus` mock; `this` is the focused input. */
type FocusMock = jest.Mock & { mock: { contexts: { props?: { testID?: string } }[] } };

/**
 * Presses the keyboard's return key in a field.
 * @returns the testID of the field that took the focus, if any. react-hook-form's `setFocus`
 *          focuses on the next tick, hence the wait.
 */
export async function pressReturnIn(testID: string): Promise<string | undefined> {
  const focus = TextInput.prototype.focus as unknown as FocusMock;
  focus.mockClear();
  fireEvent(screen.getByTestId(testID), 'submitEditing');
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return focus.mock.contexts.at(-1)?.props?.testID;
}

/** The return key a field shows, and whether pressing it keeps the keyboard open. */
export function returnKeyOf(testID: string): { returnKeyType?: string; submitBehavior?: string } {
  const { returnKeyType, submitBehavior } = screen.getByTestId(testID).props;
  return { returnKeyType, submitBehavior };
}
