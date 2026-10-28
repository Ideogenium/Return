import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { LoginForm } from '../LoginForm';
import i18n from '../../../config/i18n.config';

function renderWithProvider(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render email and password fields', () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    expect(screen.getByTestId('email-input')).toBeTruthy();
    expect(screen.getByTestId('password-input')).toBeTruthy();
    expect(screen.getByTestId('login-btn')).toBeTruthy();
  });

  it('should show validation errors when submitting empty form', async () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeTruthy();
      expect(screen.getByTestId('password-error')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with valid data', async () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.changeText(screen.getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnSubmit.mock.calls[0][0]).toEqual({
        email: 'test@example.com',
        password: 'P@ssw0rd!',
      });
    });
  });

  it('should display error prop', () => {
    renderWithProvider(
      <LoginForm onSubmit={mockOnSubmit} isLoading={false} error="Invalid credentials" />,
    );

    expect(screen.getByTestId('form-error')).toBeTruthy();
  });

  it('only requires the password to be filled in: it is verified by the API, not created', async () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.changeText(screen.getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'short');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'short' });
    });
  });

  it('trims the email before sending it (iOS autocomplete adds a trailing space)', async () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.changeText(screen.getByTestId('email-input'), 'test@example.com ');
    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'P@ssw0rd!',
      });
    });
  });

  it('asks for the email (not "invalid") when it is made only of spaces', async () => {
    renderWithProvider(<LoginForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.changeText(screen.getByTestId('email-input'), '   ');
    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-error').props.children).toBe(i18n.t('auth.emailRequired'));
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
