import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { Loan } from '../../../types/api.types';
import i18n from '../../../config/i18n.config';

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

  it('keeps a typed contest reason when the backdrop is tapped', () => {
    const onDismiss = jest.fn();
    render(
      <PaperProvider>
        <ConfirmationDialog
          loan={loan}
          visible
          onDismiss={onDismiss}
          onConfirm={jest.fn()}
          onContest={jest.fn()}
          isLoading={false}
        />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByTestId('contest-btn'));
    fireEvent.changeText(screen.getByTestId('contest-reason-input'), 'Not the right item');
    fireEvent.press(screen.getByTestId('confirmation-dialog-backdrop'));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('contest-reason-input').props.value).toBe('Not the right item');
  });

  it('closes on a backdrop tap while nothing is typed', () => {
    const onDismiss = jest.fn();
    render(
      <PaperProvider>
        <ConfirmationDialog
          loan={loan}
          visible
          onDismiss={onDismiss}
          onConfirm={jest.fn()}
          onContest={jest.fn()}
          isLoading={false}
        />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByTestId('confirmation-dialog-backdrop'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables Cancel while the contest is sent', () => {
    const props = {
      loan,
      visible: true,
      onDismiss: jest.fn(),
      onConfirm: jest.fn(),
      onContest: jest.fn(),
    };
    const { rerender } = render(
      <PaperProvider>
        <ConfirmationDialog {...props} isLoading={false} />
      </PaperProvider>,
    );
    fireEvent.press(screen.getByTestId('contest-btn'));

    rerender(
      <PaperProvider>
        <ConfirmationDialog {...props} isLoading />
      </PaperProvider>,
    );

    expect(screen.getByTestId('cancel-contest-btn').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  describe('item photos', () => {
    const loanWithPhotos = {
      ...loan,
      item: {
        name: 'Perceuse',
        photos: [
          {
            id: 'ph-1',
            url: 'https://storage.return.app/items/ph-1.jpg',
            thumbnailUrl: 'https://storage.return.app/items/ph-1_thumb.jpg',
            uploadedAt: '2026-02-20T14:00:00Z',
          },
        ],
      },
    } as unknown as Loan;

    const renderDialog = (l: Loan) =>
      render(
        <PaperProvider>
          <ConfirmationDialog
            loan={l}
            visible
            onDismiss={jest.fn()}
            onConfirm={jest.fn()}
            onContest={jest.fn()}
            isLoading={false}
          />
        </PaperProvider>,
      );

    it('shows the read-only photo gallery of the item inside the dialog content', () => {
      renderDialog(loanWithPhotos);

      const scroll = screen.getByTestId('confirmation-dialog-scroll');
      expect(within(scroll).getByTestId('photo-gallery')).toBeTruthy();
      expect(within(scroll).getByTestId('photo-thumb-ph-1')).toBeTruthy();
      expect(screen.queryByTestId('photo-delete-ph-1')).toBeNull();
      expect(screen.queryByTestId('photo-gallery-add')).toBeNull();
    });

    it('opens the full-screen viewer when a thumbnail is tapped', () => {
      renderDialog(loanWithPhotos);

      expect(screen.queryByTestId('photo-viewer')).toBeNull();
      fireEvent.press(screen.getByTestId('photo-thumb-ph-1'));

      expect(screen.getByTestId('photo-viewer')).toBeTruthy();
    });

    it('renders no gallery when the item has no photo', () => {
      renderDialog({ ...loan, item: { name: 'Perceuse', photos: [] } } as unknown as Loan);

      expect(screen.queryByTestId('photo-gallery')).toBeNull();
    });
  });
});

describe('ConfirmationDialog — lender who deleted his account (FIX-22)', () => {
  it('shows the translated label instead of the stored names', () => {
    const deletedLender = {
      ...loan,
      lender: { firstName: 'Stored', lastName: 'Names', accountDeleted: true },
    } as unknown as Loan;
    render(
      <PaperProvider>
        <ConfirmationDialog
          loan={deletedLender}
          visible
          onDismiss={jest.fn()}
          onConfirm={jest.fn()}
          onContest={jest.fn()}
          isLoading={false}
        />
      </PaperProvider>,
    );

    expect(screen.getByText(new RegExp(i18n.t('loans.deletedAccount')))).toBeTruthy();
    expect(screen.queryByText(/Stored Names/)).toBeNull();
  });
});
