import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { http, HttpResponse } from 'msw';
import { LoginScreen } from '../LoginScreen';
import { useAuthStore } from '../../../stores/useAuthStore';
import { clearTokens } from '../../../utils/storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../../navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

function DummyRegister() {
  return null;
}

function renderLoginScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={DummyRegister} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(async () => {
  server.resetHandlers();
  await clearTokens();
  useAuthStore.getState().reset();
});
afterAll(() => server.close());

describe('LoginScreen', () => {
  it('should render the login form', () => {
    renderLoginScreen();

    expect(screen.getByTestId('email-input')).toBeTruthy();
    expect(screen.getByTestId('password-input')).toBeTruthy();
    expect(screen.getByTestId('login-btn')).toBeTruthy();
  });

  it('should show error on invalid credentials', async () => {
    server.use(
      http.post('http://localhost:3000/v1/auth/login', () => {
        return HttpResponse.json(
          {
            type: 'https://api.return.app/errors/invalid-credentials',
            title: 'Invalid Credentials',
            status: 401,
            detail: 'Invalid email or password.',
            instance: '/v1/auth/login',
            timestamp: '2026-02-18T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 401 },
        );
      }),
    );

    renderLoginScreen();

    fireEvent.changeText(screen.getByTestId('email-input'), 'wrong@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'WrongP@ss1');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeTruthy();
    });
  });

  it('should authenticate on successful login', async () => {
    renderLoginScreen();

    fireEvent.changeText(screen.getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.press(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  it('clears the login error when going to the registration screen', async () => {
    renderLoginScreen();
    useAuthStore.setState({
      error: {
        type: 'https://api.return.app/errors/invalid-credentials',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid email or password.',
        instance: '/v1/auth/login',
        timestamp: '2026-10-28T10:00:00Z',
        requestId: 'req-mock',
      },
    });

    fireEvent.press(screen.getByTestId('go-register'));

    await waitFor(() => {
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
