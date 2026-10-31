import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ItemForm } from '../ItemForm';
import { pressReturnIn, returnKeyOf } from '../../../testing/keyboard';

function renderForm(props?: Partial<React.ComponentProps<typeof ItemForm>>) {
  const defaultProps = {
    onSubmit: jest.fn(),
    isLoading: false,
    submitLabel: 'Save',
    ...props,
  };
  return {
    ...render(
      <PaperProvider>
        <ItemForm {...defaultProps} />
      </PaperProvider>,
    ),
    onSubmit: defaultProps.onSubmit,
  };
}

describe('ItemForm', () => {
  it('should render all fields', () => {
    renderForm();

    expect(screen.getByTestId('name-input')).toBeTruthy();
    expect(screen.getByTestId('description-input')).toBeTruthy();
    expect(screen.getByTestId('estimatedValue-input')).toBeTruthy();
    expect(screen.getByTestId('category-chip-TOOLS')).toBeTruthy();
    expect(screen.getByTestId('category-chip-ELECTRONICS')).toBeTruthy();
    expect(screen.getByTestId('item-submit-btn')).toBeTruthy();
  });

  it('should show validation errors on empty create submit', async () => {
    const { onSubmit } = renderForm({ mode: 'create' });

    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId('category-error')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid form with default values in edit mode', async () => {
    const { onSubmit } = renderForm({
      mode: 'edit',
      defaultValues: {
        name: 'Perceuse Bosch',
        category: 'TOOLS',
        estimatedValue: 89.99,
      },
    });

    await waitFor(() => {
      fireEvent.press(screen.getByTestId('item-submit-btn'));
    });

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    const callArgs = (onSubmit as jest.Mock).mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.name).toBe('Perceuse Bosch');
    expect(callArgs.category).toBe('TOOLS');
    expect(callArgs.estimatedValue).toBe(89.99);
  });

  it('should render with default values in edit mode', () => {
    renderForm({
      mode: 'edit',
      defaultValues: {
        name: 'Tondeuse',
        category: 'GARDEN',
        description: 'Ma tondeuse',
        estimatedValue: 150,
      },
    });

    expect(screen.getByDisplayValue('Tondeuse')).toBeTruthy();
    expect(screen.getByDisplayValue('Ma tondeuse')).toBeTruthy();
    expect(screen.getByDisplayValue('150')).toBeTruthy();
  });

  it('should display API error', () => {
    renderForm({ error: 'Server error occurred' });

    expect(screen.getByTestId('form-error')).toBeTruthy();
    expect(screen.getByText('Server error occurred')).toBeTruthy();
  });

  it('should show name min length error', async () => {
    renderForm({ mode: 'create' });

    fireEvent.changeText(screen.getByTestId('name-input'), 'AB');
    fireEvent.press(screen.getByTestId('category-chip-TOOLS'));
    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeTruthy();
    });
  });

  it('should render MONEY category chip', () => {
    renderForm();

    expect(screen.getByTestId('category-chip-MONEY')).toBeTruthy();
  });

  it('should require estimatedValue when category is MONEY', async () => {
    const { onSubmit } = renderForm({ mode: 'create' });

    fireEvent.changeText(screen.getByTestId('name-input'), 'Prêt personnel');
    fireEvent.press(screen.getByTestId('category-chip-MONEY'));
    // Leave estimatedValue empty
    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('estimatedValue-error')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit when category is MONEY with estimatedValue filled', async () => {
    const { onSubmit } = renderForm({ mode: 'create' });

    fireEvent.changeText(screen.getByTestId('name-input'), 'Prêt personnel');
    fireEvent.press(screen.getByTestId('category-chip-MONEY'));
    fireEvent.changeText(screen.getByTestId('estimatedValue-input'), '500');
    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    const callArgs = (onSubmit as jest.Mock).mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.category).toBe('MONEY');
    expect(callArgs.estimatedValue).toBe(500);
  });

  it('should submit with decimal value 12.5', async () => {
    const { onSubmit } = renderForm({ mode: 'create' });

    fireEvent.changeText(screen.getByTestId('name-input'), 'Perceuse Bosch');
    fireEvent.press(screen.getByTestId('category-chip-TOOLS'));
    fireEvent.changeText(screen.getByTestId('estimatedValue-input'), '12.5');
    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    const callArgs = (onSubmit as jest.Mock).mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.estimatedValue).toBe(12.5);
  });

  it('should preserve trailing dot while typing "12."', () => {
    renderForm();

    fireEvent.changeText(screen.getByTestId('estimatedValue-input'), '12.');

    expect(screen.getByDisplayValue('12.')).toBeTruthy();
  });

  it('should normalize "12." to "12" on blur', () => {
    renderForm();

    const input = screen.getByTestId('estimatedValue-input');
    fireEvent.changeText(input, '12.');
    fireEvent(input, 'blur');

    expect(screen.getByDisplayValue('12')).toBeTruthy();
  });

  it('should not require estimatedValue for non-MONEY categories', async () => {
    const { onSubmit } = renderForm({ mode: 'create' });

    fireEvent.changeText(screen.getByTestId('name-input'), 'Perceuse Bosch');
    fireEvent.press(screen.getByTestId('category-chip-TOOLS'));
    // Leave estimatedValue empty
    fireEvent.press(screen.getByTestId('item-submit-btn'));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    expect(screen.queryByTestId('estimatedValue-error')).toBeNull();
  });
});

describe('ItemForm keyboard', () => {
  it('moves from the name to the description with the return key', async () => {
    renderForm();

    expect(returnKeyOf('name-input')).toEqual({ returnKeyType: 'next', submitBehavior: 'submit' });
    expect(await pressReturnIn('name-input')).toBe('description-input');
  });

  it('keeps the return key for new lines in the description', () => {
    renderForm();

    expect(returnKeyOf('description-input')).toEqual({
      returnKeyType: undefined,
      submitBehavior: undefined,
    });
    expect(screen.getByTestId('description-input').props.onSubmitEditing).toBeUndefined();
  });

  it('saves from the value field', async () => {
    const { onSubmit } = renderForm();
    fireEvent.changeText(screen.getByTestId('name-input'), 'Drill');
    fireEvent.press(screen.getByTestId('category-chip-TOOLS'));

    expect(returnKeyOf('estimatedValue-input').returnKeyType).toBe('done');
    await pressReturnIn('estimatedValue-input');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('does not save again while saving', async () => {
    const { onSubmit } = renderForm({ isLoading: true });
    fireEvent.changeText(screen.getByTestId('name-input'), 'Drill');
    fireEvent.press(screen.getByTestId('category-chip-TOOLS'));

    await pressReturnIn('estimatedValue-input');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
