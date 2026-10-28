import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { BorrowerForm } from '../BorrowerForm';
import i18n from '../../../config/i18n.config';

function renderWithProvider(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe('BorrowerForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render all 4 fields', () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    expect(screen.getByTestId('firstName-input')).toBeTruthy();
    expect(screen.getByTestId('lastName-input')).toBeTruthy();
    expect(screen.getByTestId('email-input')).toBeTruthy();
    expect(screen.getByTestId('phone-input')).toBeTruthy();
    expect(screen.getByTestId('borrower-submit-btn')).toBeTruthy();
  });

  it('should show validation errors on empty submit', async () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('firstName-error')).toBeTruthy();
      expect(screen.getByTestId('lastName-error')).toBeTruthy();
      expect(screen.getByTestId('email-error')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should show error for invalid email', async () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Marie');
    fireEvent.changeText(screen.getByTestId('lastName-input'), 'Dupont');
    fireEvent.changeText(screen.getByTestId('email-input'), 'not-an-email');
    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with valid data', async () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Marie');
    fireEvent.changeText(screen.getByTestId('lastName-input'), 'Dupont');
    fireEvent.changeText(screen.getByTestId('email-input'), 'marie@example.com');
    fireEvent.changeText(screen.getByTestId('phone-input'), '+33612345678');
    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnSubmit.mock.calls[0][0]).toEqual({
        firstName: 'Marie',
        lastName: 'Dupont',
        email: 'marie@example.com',
        phoneNumber: '+33612345678',
      });
    });
  });

  it('should not require fields in edit mode', async () => {
    renderWithProvider(
      <BorrowerForm
        mode="edit"
        defaultValues={{ firstName: 'Marie', lastName: 'Dupont', email: 'marie@example.com' }}
        onSubmit={mockOnSubmit}
        isLoading={false}
        submitLabel="Save"
      />,
    );

    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('firstName-error')).toBeNull();
    expect(screen.queryByTestId('lastName-error')).toBeNull();
    expect(screen.queryByTestId('email-error')).toBeNull();
  });

  it('should display error prop', () => {
    renderWithProvider(
      <BorrowerForm
        onSubmit={mockOnSubmit}
        isLoading={false}
        submitLabel="Save"
        error="This contact already exists"
      />,
    );

    expect(screen.getByTestId('form-error')).toBeTruthy();
  });

  // FIX-09 — email field lock in edit mode
  describe('FIX-09: email field lock in edit mode', () => {
    const editDefaultValues = {
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie@example.com',
    };

    it('should render email-input as non-editable in edit mode', () => {
      renderWithProvider(
        <BorrowerForm
          mode="edit"
          defaultValues={editDefaultValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          submitLabel="Save"
        />,
      );

      const emailInput = screen.getByTestId('email-input');
      expect(emailInput.props.editable).toBe(false);
    });

    it('should display the readonly hint in edit mode', () => {
      renderWithProvider(
        <BorrowerForm
          mode="edit"
          defaultValues={editDefaultValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          submitLabel="Save"
        />,
      );

      expect(screen.getByTestId('email-readonly-hint')).toBeTruthy();
    });

    it('should display the default email value in edit mode', () => {
      renderWithProvider(
        <BorrowerForm
          mode="edit"
          defaultValues={editDefaultValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          submitLabel="Save"
        />,
      );

      const emailInput = screen.getByTestId('email-input');
      expect(emailInput.props.value).toBe('marie@example.com');
    });

    it('should render email-input as editable in create mode and not show readonly hint', () => {
      renderWithProvider(
        <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
      );

      const emailInput = screen.getByTestId('email-input');
      expect(emailInput.props.editable).not.toBe(false);
      expect(screen.queryByTestId('email-readonly-hint')).toBeNull();
    });
  });

  it('accepts and trims an email ending with a space (iOS autocomplete)', async () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Marie');
    fireEvent.changeText(screen.getByTestId('lastName-input'), 'Dupont');
    fireEvent.changeText(screen.getByTestId('email-input'), ' marie@example.com ');
    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'marie@example.com' }),
      );
    });
  });

  it('asks for the email (not "invalid") when it is made only of spaces', async () => {
    renderWithProvider(
      <BorrowerForm onSubmit={mockOnSubmit} isLoading={false} submitLabel="Save" />,
    );

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Marie');
    fireEvent.changeText(screen.getByTestId('lastName-input'), 'Dupont');
    fireEvent.changeText(screen.getByTestId('email-input'), '   ');
    fireEvent.press(screen.getByTestId('borrower-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-error').props.children).toBe(i18n.t('auth.emailRequired'));
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
