import { render, screen, act } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';
import { useAuthStore } from '../../stores/useAuthStore';

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../services/pushNotifications', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve(null)),
  setupNotificationHandler: jest.fn(),
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
});
