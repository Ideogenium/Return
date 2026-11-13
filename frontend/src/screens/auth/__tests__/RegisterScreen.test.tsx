import { Linking } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import i18n from '../../../config/i18n.config';
import { RegisterScreen } from '../RegisterScreen';
import { useAuthStore } from '../../../stores/useAuthStore';
import { clearTokens } from '../../../utils/storage';
import type { AuthStackParamList } from '../../../navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

function DummyLogin() {
  return null;
}

function renderRegisterScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Register">
          <Stack.Screen name="Login" component={DummyLogin} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

function fillAndSubmit(password = 'Retour2026!') {
  fireEvent.changeText(screen.getByTestId('firstName-input'), 'Jane');
  fireEvent.changeText(screen.getByTestId('lastName-input'), 'Doe');
  fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
  fireEvent.changeText(screen.getByTestId('password-input'), password);
  fireEvent.changeText(screen.getByTestId('confirmPassword-input'), password);
  fireEvent.press(screen.getByTestId('register-btn'));
}

const problem = (type: string, status: number, extra: object = {}) => ({
  type: `https://api.return.app/errors/${type}`,
  title: 'Error',
  status,
  detail: 'Error',
  instance: '/v1/auth/register',
  timestamp: '2026-10-28T10:00:00Z',
  requestId: 'req-mock',
  ...extra,
});

beforeAll(() => {
  server.listen();
  return i18n.changeLanguage('en');
});
afterEach(async () => {
  server.resetHandlers();
  await clearTokens();
  act(() => useAuthStore.getState().reset());
});
afterAll(() => server.close());

describe('RegisterScreen', () => {
  it('shows an API password validation error under the password field, not as a generic banner', async () => {
    server.use(
      http.post('http://localhost:3000/v1/auth/register', () =>
        HttpResponse.json(
          problem('validation-failed', 400, {
            errors: [{ field: 'password', code: 'INVALID_FORMAT', message: 'Password must…' }],
          }),
          { status: 400 },
        ),
      ),
    );

    renderRegisterScreen();
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('password-error').props.children).toContain('@ $ ! % * ? &');
    });
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('still shows a message when the API validation error concerns no displayed field', async () => {
    server.use(
      http.post('http://localhost:3000/v1/auth/register', () =>
        HttpResponse.json(
          problem('validation-failed', 400, {
            errors: [
              { field: 'role', code: 'UNKNOWN_FIELD', message: 'property role should not exist' },
            ],
          }),
          { status: 400 },
        ),
      ),
    );

    renderRegisterScreen();
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeTruthy();
    });
  });

  it('keeps showing non-field errors (email already used) as a form message', async () => {
    server.use(
      http.post('http://localhost:3000/v1/auth/register', () =>
        HttpResponse.json(problem('email-already-exists', 409), { status: 409 }),
      ),
    );

    renderRegisterScreen();
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeTruthy();
    });
  });

  it('clears the registration error when going to the login screen', async () => {
    renderRegisterScreen();
    act(() => useAuthStore.setState({ error: problem('email-already-exists', 409) }));

    fireEvent.press(screen.getByTestId('go-login'));

    await waitFor(() => {
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  it('opens the privacy policy in the active language from the consent line', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    renderRegisterScreen();

    fireEvent.press(screen.getByTestId('register-privacy-link'));

    expect(openURL).toHaveBeenCalledWith('http://localhost:3000/privacy?lang=en');
    openURL.mockRestore();
  });

  it('does not crash when the privacy policy cannot be opened', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    renderRegisterScreen();

    fireEvent.press(screen.getByTestId('register-privacy-link'));

    await waitFor(() => expect(openURL).toHaveBeenCalled());
    expect(screen.getByTestId('register-btn')).toBeTruthy();
    openURL.mockRestore();
  });
});
