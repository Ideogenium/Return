import { render, screen, act } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../../services/pushNotifications';
import { navigateToInvitationsFromPush, navigateToLoanDetail } from '../navigationRef';

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../services/pushNotifications', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve(null)),
  setupNotificationHandler: jest.fn(),
}));

jest.mock('../navigationRef', () => ({
  navigateToLoanDetail: jest.fn(),
  navigateToInvitationsFromPush: jest.fn(),
}));

jest.mock('../AuthNavigator', () => {
  const { Text } = require('react-native');
  return { AuthNavigator: () => <Text testID="auth-navigator">auth</Text> };
});

jest.mock('../AppNavigator', () => {
  const { Text } = require('react-native');
  return { AppNavigator: () => <Text testID="app-navigator">app</Text> };
});

describe('RootNavigator', () => {
  beforeEach(() => {
    useAuthStore.setState({ hydrate: jest.fn(() => Promise.resolve()) });
  });

  afterEach(() => {
    act(() => useAuthStore.getState().reset());
  });

  it('shows the splash screen only while the stored session is being restored', () => {
    act(() => useAuthStore.setState({ isHydrating: true }));

    render(<RootNavigator />);

    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(screen.queryByTestId('auth-navigator')).toBeNull();
  });

  it('keeps the auth screens mounted while a registration or login is in flight', () => {
    act(() => useAuthStore.setState({ isHydrating: false, isLoading: true }));

    render(<RootNavigator />);

    expect(screen.getByTestId('auth-navigator')).toBeTruthy();
    expect(screen.queryByTestId('splash-screen')).toBeNull();
  });

  it('keeps the app mounted while an authenticated action (e.g. avatar upload) is in flight', () => {
    act(() =>
      useAuthStore.setState({ isHydrating: false, isLoading: true, isAuthenticated: true }),
    );

    render(<RootNavigator />);

    expect(screen.getByTestId('app-navigator')).toBeTruthy();
  });

  // FIX-23: the unregistration moved into logout (it needs a valid JWT), RootNavigator must not repeat it
  it('does not unregister the device token when the user becomes unauthenticated, but resets the session stores', async () => {
    const unregisterDeviceToken = jest.fn(() => Promise.resolve());
    useNotificationStore.setState({
      unregisterDeviceToken,
      fetchNotifications: jest.fn(() => Promise.resolve()),
    });
    act(() => useAuthStore.setState({ isHydrating: false, isAuthenticated: true }));
    render(<RootNavigator />);
    await act(async () => {});
    expect(registerForPushNotifications).toHaveBeenCalled();
    act(() => useNotificationStore.setState({ unreadCount: 3, deviceToken: 'expo-token-123' }));

    act(() => useAuthStore.setState({ isAuthenticated: false }));

    expect(unregisterDeviceToken).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  describe('push notification tap', () => {
    const tap = (data: Record<string, unknown>) => {
      const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
        .calls[0][0];
      listener({ notification: { request: { content: { data } } } });
    };

    beforeEach(() => jest.clearAllMocks());

    it('opens the loan detail when the push carries a loanId', () => {
      render(<RootNavigator />);

      tap({ loanId: 'loan-1', type: 'LOAN_CREATED' });

      expect(navigateToLoanDetail).toHaveBeenCalledWith('loan-1');
      expect(navigateToInvitationsFromPush).not.toHaveBeenCalled();
    });

    it('opens the invitations for a contact invitation push', () => {
      render(<RootNavigator />);

      tap({ type: 'CONTACT_INVITATION_RECEIVED', invitationId: 'inv-1' });

      expect(navigateToInvitationsFromPush).toHaveBeenCalledWith('CONTACT_INVITATION_RECEIVED');
      expect(navigateToLoanDetail).not.toHaveBeenCalled();
    });

    it('handles a contact invitation push that launched the app from a killed state', async () => {
      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce({
        notification: {
          request: {
            content: { data: { type: 'CONTACT_INVITATION_ACCEPTED', invitationId: 'i' } },
          },
        },
      });

      render(<RootNavigator />);
      await act(async () => {});

      expect(navigateToInvitationsFromPush).toHaveBeenCalledWith('CONTACT_INVITATION_ACCEPTED');
    });
  });
});
