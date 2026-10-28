import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { server } from '../../../../__mocks__/server';
import { ProfileScreen } from '../ProfileScreen';
import { useAuthStore } from '../../../stores/useAuthStore';
import i18n from '../../../config/i18n.config';

const Stack = createNativeStackNavigator();

// Real store actions, captured before any test replaces them.
const authDefaults = useAuthStore.getState();

function renderProfile() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Profile" component={ProfileScreen as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => {
  server.listen();
  return i18n.changeLanguage('en');
});
afterEach(() => {
  server.resetHandlers();
  act(() => useAuthStore.getState().reset());
});
afterAll(() => server.close());

describe('ProfileScreen', () => {
  it('reloads a missing profile without restoring the session, which would tear down the navigation', async () => {
    const hydrate = jest.fn(() => Promise.resolve());
    const refreshUser = jest.fn(() => Promise.resolve());
    act(() => useAuthStore.setState({ user: null, hydrate, refreshUser }));

    render(
      <PaperProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Profile" component={ProfileScreen as never} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalled();
    });
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('shows the error with a retry instead of an endless spinner when the profile cannot be loaded', async () => {
    server.use(http.get('http://localhost:3000/v1/users/me', () => HttpResponse.error()));
    act(() => useAuthStore.setState({ ...authDefaults, user: null }));

    renderProfile();

    await waitFor(() => {
      expect(screen.getByTestId('profile-error')).toBeTruthy();
    });
    expect(screen.getByText(i18n.t('errors.networkError'))).toBeTruthy();
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('loads the profile when the user retries after a failure', async () => {
    server.use(
      http.get('http://localhost:3000/v1/users/me', () => HttpResponse.error(), { once: true }),
    );
    act(() => useAuthStore.setState({ ...authDefaults, user: null }));

    renderProfile();
    await waitFor(() => {
      expect(screen.getByTestId('profile-retry-btn')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('profile-retry-btn'));

    await waitFor(() => {
      expect(useAuthStore.getState().user).not.toBeNull();
    });
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });
});
