import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { EditProfileForm } from '../EditProfileForm';
import type { User } from '../../../types/api.types';
import { pressReturnIn, returnKeyOf } from '../../../testing/keyboard';

const mockUser: User = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'LENDER',
  createdAt: '2026-02-01T10:00:00Z',
};

function renderWithProvider(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe('EditProfileForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render with user default values', () => {
    renderWithProvider(
      <EditProfileForm user={mockUser} onSubmit={mockOnSubmit} isLoading={false} />,
    );

    expect(screen.getByTestId('firstName-input').props.value).toBe('John');
    expect(screen.getByTestId('lastName-input').props.value).toBe('Doe');
    expect(screen.getByTestId('email-input').props.value).toBe('test@example.com');
  });

  it('should call onSubmit with updated values', async () => {
    renderWithProvider(
      <EditProfileForm user={mockUser} onSubmit={mockOnSubmit} isLoading={false} />,
    );

    fireEvent.changeText(screen.getByTestId('firstName-input'), 'Johnny');
    fireEvent.press(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnSubmit.mock.calls[0][0]).toEqual({
        firstName: 'Johnny',
        lastName: 'Doe',
        email: 'test@example.com',
        phone: '',
      });
    });
  });

  it('should call onSubmit with updated email', async () => {
    renderWithProvider(
      <EditProfileForm user={mockUser} onSubmit={mockOnSubmit} isLoading={false} />,
    );

    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com');
    fireEvent.press(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnSubmit.mock.calls[0][0]).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'new@example.com',
        phone: '',
      });
    });
  });

  it('accepts and trims an email ending with a space (iOS autocomplete)', async () => {
    renderWithProvider(
      <EditProfileForm user={mockUser} onSubmit={mockOnSubmit} isLoading={false} />,
    );

    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com ');
    fireEvent.press(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
    });
  });

  it('treats an email made only of spaces as empty and does not send it', async () => {
    renderWithProvider(
      <EditProfileForm user={mockUser} onSubmit={mockOnSubmit} isLoading={false} />,
    );

    fireEvent.changeText(screen.getByTestId('email-input'), '   ');
    fireEvent.press(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
    expect(mockOnSubmit.mock.calls[0][0]).not.toHaveProperty('email');
  });
});

describe('EditProfileForm keyboard', () => {
  it('moves through the fields with the return key', async () => {
    renderWithProvider(<EditProfileForm user={mockUser} onSubmit={jest.fn()} isLoading={false} />);

    expect(await pressReturnIn('firstName-input')).toBe('lastName-input');
    expect(await pressReturnIn('lastName-input')).toBe('email-input');
    expect(await pressReturnIn('email-input')).toBe('phone-input');
    ['firstName-input', 'lastName-input', 'email-input'].forEach((id) =>
      expect(returnKeyOf(id)).toEqual({ returnKeyType: 'next', submitBehavior: 'submit' }),
    );
  });

  it('saves from the last field', async () => {
    const onSubmit = jest.fn();
    renderWithProvider(<EditProfileForm user={mockUser} onSubmit={onSubmit} isLoading={false} />);

    expect(returnKeyOf('phone-input').returnKeyType).toBe('done');
    await pressReturnIn('phone-input');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('does not save again while saving', async () => {
    const onSubmit = jest.fn();
    renderWithProvider(<EditProfileForm user={mockUser} onSubmit={onSubmit} isLoading />);

    await pressReturnIn('phone-input');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
