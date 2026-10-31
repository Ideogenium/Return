import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { pressReturnIn, returnKeyOf } from '../../../testing/keyboard';

function renderForm(props: Partial<React.ComponentProps<typeof ChangePasswordForm>> = {}) {
  const onSubmit = jest.fn();
  render(
    <PaperProvider>
      <ChangePasswordForm onSubmit={onSubmit} isLoading={false} {...props} />
    </PaperProvider>,
  );
  return onSubmit;
}

function fill(current: string, next: string) {
  fireEvent.changeText(screen.getByTestId('currentPassword-input'), current);
  fireEvent.changeText(screen.getByTestId('newPassword-input'), next);
  fireEvent.changeText(screen.getByTestId('confirmNewPassword-input'), next);
  fireEvent.press(screen.getByTestId('changePassword-btn'));
}

describe('ChangePasswordForm', () => {
  it('explains the new password rules before any error, including the accepted special characters', () => {
    renderForm();

    expect(screen.getByTestId('newPassword-rules').props.children).toContain('@ $ ! % * ? &');
  });

  it('refuses a new password with a character the API rejects and names that character', async () => {
    const onSubmit = renderForm();

    fill('anything', 'Retour2026!#');

    await waitFor(() => {
      expect(screen.getByTestId('newPassword-error').props.children).toContain('#');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('only requires the current password to be filled in, since the API only verifies it', async () => {
    const onSubmit = renderForm();

    fill('short', 'Retour2026!');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        currentPassword: 'short',
        newPassword: 'Retour2026!',
      });
    });
  });

  it('shows a field error returned by the API under that field', async () => {
    renderForm({ fieldErrors: { newPassword: 'Refused by the API' } });

    await waitFor(() => {
      expect(screen.getByTestId('newPassword-error').props.children).toBe('Refused by the API');
    });
  });
});

describe('ChangePasswordForm keyboard', () => {
  it('moves through the three fields with the return key', async () => {
    renderForm();

    expect(await pressReturnIn('currentPassword-input')).toBe('newPassword-input');
    expect(await pressReturnIn('newPassword-input')).toBe('confirmNewPassword-input');
    ['currentPassword-input', 'newPassword-input'].forEach((id) =>
      expect(returnKeyOf(id)).toEqual({ returnKeyType: 'next', submitBehavior: 'submit' }),
    );
  });

  it('submits from the confirmation field', async () => {
    const onSubmit = renderForm();
    fireEvent.changeText(screen.getByTestId('currentPassword-input'), 'OldPass1!');
    fireEvent.changeText(screen.getByTestId('newPassword-input'), 'NewPass1!');
    fireEvent.changeText(screen.getByTestId('confirmNewPassword-input'), 'NewPass1!');

    expect(returnKeyOf('confirmNewPassword-input').returnKeyType).toBe('done');
    await pressReturnIn('confirmNewPassword-input');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('does not submit again while the password is being changed', async () => {
    const onSubmit = renderForm({ isLoading: true });
    fireEvent.changeText(screen.getByTestId('currentPassword-input'), 'OldPass1!');
    fireEvent.changeText(screen.getByTestId('newPassword-input'), 'NewPass1!');
    fireEvent.changeText(screen.getByTestId('confirmNewPassword-input'), 'NewPass1!');

    await pressReturnIn('confirmNewPassword-input');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
