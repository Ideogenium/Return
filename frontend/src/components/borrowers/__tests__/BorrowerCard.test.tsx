import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import i18n from '../../../config/i18n.config';
import { BorrowerCard } from '../BorrowerCard';
import type { Borrower } from '../../../types/api.types';

const CONTACT: Borrower = {
  id: 'contact-1',
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
};

function renderCard(borrower: Borrower) {
  return render(
    <PaperProvider>
      <BorrowerCard borrower={borrower} onPress={jest.fn()} />
    </PaperProvider>,
  );
}

describe('BorrowerCard', () => {
  it('shows the contact email', () => {
    renderCard(CONTACT);

    expect(screen.getByTestId('borrower-email-contact-1')).toHaveTextContent('marie@example.com');
  });

  // FIX-22 (C4): the account behind the contact was deleted, its email is a meaningless placeholder.
  it('shows a translated label instead of the placeholder email of a deleted account', () => {
    renderCard({
      ...CONTACT,
      email: 'deleted+contact-1.a1b2c3d4e5f60718@deleted.invalid',
      accountDeleted: true,
    });

    expect(screen.getByTestId('borrower-email-contact-1')).toHaveTextContent(
      i18n.t('loans.deletedAccount'),
    );
    expect(screen.queryByText(/deleted\.invalid/)).toBeNull();
    // The name the lender gave stays.
    expect(screen.getByText('Marie Dupont')).toBeTruthy();
  });
});
