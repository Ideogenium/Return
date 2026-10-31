import { render, screen, fireEvent } from '@testing-library/react-native';
import { Icon, PaperProvider } from 'react-native-paper';
import { NotificationCard } from '../NotificationCard';
import type { Notification } from '../../../types/api.types';

const unreadNotification: Notification = {
  id: 'notif-1',
  type: 'LOAN_CREATED',
  title: 'New loan',
  body: 'You received a loan',
  isRead: false,
  relatedLoanId: 'loan-1',
  createdAt: new Date().toISOString(),
};

const readNotification: Notification = {
  id: 'notif-2',
  type: 'LOAN_CONFIRMED',
  title: 'Loan confirmed',
  body: 'Your loan was confirmed',
  isRead: true,
  relatedLoanId: 'loan-1',
  createdAt: '2026-03-17T08:00:00Z',
};

function renderCard(notification: Notification, onMarkRead?: (id: string) => void) {
  const onPress = jest.fn();
  return {
    onPress,
    ...render(
      <PaperProvider>
        <NotificationCard notification={notification} onPress={onPress} onMarkRead={onMarkRead} />
      </PaperProvider>,
    ),
  };
}

describe('NotificationCard', () => {
  it('should display title and body', () => {
    renderCard(unreadNotification);

    expect(screen.getByText('New loan')).toBeTruthy();
    expect(screen.getByText('You received a loan')).toBeTruthy();
  });

  it('should have correct testID', () => {
    renderCard(unreadNotification);

    expect(screen.getByTestId('notification-card-notif-1')).toBeTruthy();
  });

  it('should call onPress when tapped', () => {
    const { onPress } = renderCard(unreadNotification);

    fireEvent.press(screen.getByTestId('notification-card-notif-1'));
    expect(onPress).toHaveBeenCalledWith(unreadNotification);
  });

  it('should show mark-read button for unread notifications', () => {
    const onMarkRead = jest.fn();
    renderCard(unreadNotification, onMarkRead);

    const btn = screen.getByTestId('mark-read-notif-1');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(onMarkRead).toHaveBeenCalledWith('notif-1');
  });

  it('should not show mark-read button for read notifications', () => {
    renderCard(readNotification);

    expect(screen.queryByTestId('mark-read-notif-2')).toBeNull();
  });

  describe('icon by type', () => {
    const iconFor = (type: Notification['type']) => {
      renderCard({ ...unreadNotification, type, relatedLoanId: null });
      return screen.UNSAFE_getByType(Icon).props.source;
    };

    it('uses account-plus for a received contact invitation', () => {
      expect(iconFor('CONTACT_INVITATION_RECEIVED')).toBe('account-plus');
    });

    it('uses account-check for an accepted contact invitation', () => {
      expect(iconFor('CONTACT_INVITATION_ACCEPTED')).toBe('account-check');
    });

    it('keeps the loan icon for loan notifications', () => {
      expect(iconFor('LOAN_CREATED')).toBe('handshake-outline');
    });
  });
});
