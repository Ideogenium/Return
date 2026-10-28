import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ChangePasswordForm } from '../ChangePasswordForm';

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
