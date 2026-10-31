import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { Loan } from '../../../types/api.types';

const loan = {
  id: 'loan-1',
  item: { name: 'Perceuse' },
  lender: { firstName: 'Marie', lastName: 'Dupont' },
  returnDate: '2026-11-15',
} as unknown as Loan;

describe('ConfirmationDialog', () => {
  // The contest reason sits in a centered dialog: without a keyboard-aware scroll view the
  // keyboard covers it and its buttons on a small screen.
  it('keeps the contest reason usable with the keyboard open', () => {
    render(
      <PaperProvider>
        <ConfirmationDialog
          loan={loan}
          visible
          onDismiss={jest.fn()}
          onConfirm={jest.fn()}
          onContest={jest.fn()}
          isLoading={false}
        />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByTestId('contest-btn'));

    const scroll = screen.getByTestId('confirmation-dialog-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(within(scroll).getByTestId('contest-reason-input')).toBeTruthy();
  });
});
