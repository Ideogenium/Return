import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { LoanWizard } from '../LoanWizard';
import { useItemStore } from '../../../stores/useItemStore';
import { useBorrowerStore } from '../../../stores/useBorrowerStore';

// Mock react-native-paper-dates: replace Calendar with a minimal pressable that
// triggers onChange with a fixed future date, bypassing the real calendar UI.
jest.mock('react-native-paper-dates', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    Calendar: ({ onChange }: { onChange: (params: { date: Date }) => void }) =>
      React.createElement(Pressable, {
        testID: 'mock-calendar-select',
        onPress: () => onChange({ date: new Date('2025-12-31T00:00:00Z') }),
      }),
  };
});

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useItemStore.getState().reset();
  useBorrowerStore.getState().reset();
});
afterAll(() => server.close());

const mockSubmit = jest.fn();

function renderWizard() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <LoanWizard onSubmit={mockSubmit} isLoading={false} />
      </NavigationContainer>
    </PaperProvider>,
  );
}

async function setupStoresWithData() {
  await useItemStore.getState().fetchItems();
  await useBorrowerStore.getState().fetchBorrowers();
}

beforeEach(() => {
  mockSubmit.mockClear();
});

describe('LoanWizard', () => {
  it('should render step 1 with type selection', () => {
    renderWizard();

    expect(screen.getByTestId('loan-wizard')).toBeTruthy();
    expect(screen.getByTestId('wizard-step-1')).toBeTruthy();
    expect(screen.getByTestId('type-object')).toBeTruthy();
    expect(screen.getByTestId('type-money')).toBeTruthy();
  });

  it('should navigate through 4 steps for OBJECT flow', async () => {
    await setupStoresWithData();
    renderWizard();

    // Step 1: select OBJECT (default)
    expect(screen.getByTestId('wizard-step-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 2: select item
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });
    expect(screen.getByText('Perceuse Bosch')).toBeTruthy();

    // Select the item
    fireEvent.press(screen.getByTestId('select-item-9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 3: select borrower
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-3')).toBeTruthy();
    });
    expect(screen.getByText('Marie Dupont')).toBeTruthy();

    fireEvent.press(screen.getByTestId('select-borrower-5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 4: summary
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-4')).toBeTruthy();
    });
    expect(screen.getByTestId('wizard-submit-btn')).toBeTruthy();
  }, 15000);

  it('should navigate through 4 steps for MONEY flow', async () => {
    await setupStoresWithData();
    renderWizard();

    // Step 1: select MONEY
    fireEvent.press(screen.getByTestId('type-money'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 2: enter amount
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });
    expect(screen.getByTestId('amount-input')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('amount-input'), '50');
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 3: select borrower
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-3')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('select-borrower-5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 4: select return date then submit
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-4')).toBeTruthy();
    });

    // Open the (mock) calendar and select a date
    fireEvent.press(screen.getByTestId('return-date-input'));
    fireEvent.press(screen.getByTestId('mock-calendar-select'));

    fireEvent.press(screen.getByTestId('wizard-submit-btn'));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        borrowerId: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
        returnDate: '2025-12-31',
      }),
    );
  }, 15000);

  it('should keep submit disabled and show error until a return date is selected', async () => {
    await setupStoresWithData();
    renderWizard();

    // Step 1: select MONEY
    fireEvent.press(screen.getByTestId('type-money'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 2: enter amount
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByTestId('amount-input'), '100');
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 3: select borrower
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-3')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('select-borrower-5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    // Step 4: no date selected yet
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-4')).toBeTruthy();
    });

    // Error helper text is visible when no date is set
    expect(screen.getByTestId('return-date-required')).toBeTruthy();

    // Pressing the disabled submit button must not call onSubmit
    // (Paper Button with disabled=true does not fire onPress)
    fireEvent.press(screen.getByTestId('wizard-submit-btn'));
    expect(mockSubmit).not.toHaveBeenCalled();

    // Select a return date via the mock calendar
    fireEvent.press(screen.getByTestId('return-date-input'));
    fireEvent.press(screen.getByTestId('mock-calendar-select'));

    // Error helper text must disappear once a date is set
    expect(screen.queryByTestId('return-date-required')).toBeNull();

    // Submit button is now enabled and calls onSubmit
    fireEvent.press(screen.getByTestId('wizard-submit-btn'));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  }, 15000);

  it('should navigate back from step 2', async () => {
    renderWizard();

    // Go to step 2
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });

    // Go back to step 1
    fireEvent.press(screen.getByTestId('wizard-back-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-1')).toBeTruthy();
    });
  });

  it('should show inline create item button on step 2', async () => {
    renderWizard();

    // Go to step 2
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });

    expect(screen.getByTestId('inline-create-item-btn')).toBeTruthy();
  });

  it('should show empty state with search contact button on step 3 when no borrowers', async () => {
    await useItemStore.getState().fetchItems();
    renderWizard();

    // Go to step 2
    fireEvent.press(screen.getByTestId('wizard-next-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeTruthy();
    });

    // Select item and go to step 3
    fireEvent.press(screen.getByTestId('select-item-9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d'));
    fireEvent.press(screen.getByTestId('wizard-next-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-3')).toBeTruthy();
    });

    expect(screen.getByTestId('no-borrowers-empty')).toBeTruthy();
    expect(screen.getByTestId('search-contact-btn')).toBeTruthy();
  });
});
