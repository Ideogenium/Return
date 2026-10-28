import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { RegisterForm } from '../RegisterForm';

function renderWithProvider(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe('RegisterForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render all fields', () => {
    renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);

    expect(screen.getByTestId('firstName-input')).toBeTruthy();
    expect(screen.getByTestId('lastName-input')).toBeTruthy();
    expect(screen.getByTestId('email-input')).toBeTruthy();
    expect(screen.getByTestId('password-input')).toBeTruthy();
    expect(screen.getByTestId('confirmPassword-input')).toBeTruthy();
    expect(screen.getByTestId('register-btn')).toBeTruthy();
  });

  it('should show validation errors when submitting empty form', async () => {
    renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.press(screen.getByTestId('register-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('firstName-error')).toBeTruthy();
      expect(screen.getByTestId('lastName-error')).toBeTruthy();
      expect(screen.getByTestId('email-error')).toBeTruthy();
      expect(screen.getByTestId('password-error')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with valid data (without confirmPassword)', async () => {
    renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Jane');
    fireEvent.changeText(screen.getByTestId('lastName-input'), 'Doe');
    fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.changeText(screen.getByTestId('confirmPassword-input'), 'P@ssw0rd!');
    fireEvent.press(screen.getByTestId('register-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'P@ssw0rd!',
        firstName: 'Jane',
        lastName: 'Doe',
      });
    });
  });

  it('should display error prop', () => {
    renderWithProvider(
      <RegisterForm onSubmit={mockOnSubmit} isLoading={false} error="Email already exists" />,
    );

    expect(screen.getByTestId('form-error')).toBeTruthy();
  });

  describe('password rules shown and enforced like the API contract', () => {
    const fillValidFormExceptPassword = () => {
      fireEvent.changeText(screen.getByTestId('firstName-input'), 'Jane');
      fireEvent.changeText(screen.getByTestId('lastName-input'), 'Doe');
      fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    };

    it('explains the password rules before any error, including the accepted special characters', () => {
      renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);

      expect(screen.getByTestId('password-rules').props.children).toContain('@ $ ! % * ? &');
    });

    it('refuses a password with a character the API rejects and names that character', async () => {
      renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);
      fillValidFormExceptPassword();
      fireEvent.changeText(screen.getByTestId('password-input'), 'Retour2026!#');
      fireEvent.changeText(screen.getByTestId('confirmPassword-input'), 'Retour2026!#');
      fireEvent.press(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeTruthy();
      });
      expect(screen.getByTestId('password-error').props.children).toContain('#');
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('trims the email before sending it (iOS autocomplete adds a trailing space)', async () => {
      renderWithProvider(<RegisterForm onSubmit={mockOnSubmit} isLoading={false} />);
      fireEvent.changeText(screen.getByTestId('firstName-input'), 'Jane');
      fireEvent.changeText(screen.getByTestId('lastName-input'), 'Doe');
      fireEvent.changeText(screen.getByTestId('email-input'), ' jane@example.com ');
      fireEvent.changeText(screen.getByTestId('password-input'), 'Retour2026!');
      fireEvent.changeText(screen.getByTestId('confirmPassword-input'), 'Retour2026!');
      fireEvent.press(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'jane@example.com' }),
        );
      });
    });

    it('shows a field error returned by the API under that field', async () => {
      renderWithProvider(
        <RegisterForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          fieldErrors={{ password: 'Refused by the API' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('password-error').props.children).toBe('Refused by the API');
      });
    });
  });
});
