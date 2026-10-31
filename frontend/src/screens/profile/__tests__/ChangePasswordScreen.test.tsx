import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import i18n from '../../../config/i18n.config';
import { ChangePasswordScreen } from '../ChangePasswordScreen';

const Stack = createNativeStackNavigator();

function renderScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => {
  server.listen();
  return i18n.changeLanguage('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ChangePasswordScreen', () => {
  it('shows an API validation error on the new password under that field', async () => {
    server.use(
      http.patch('http://localhost:3000/v1/users/me/password', () =>
        HttpResponse.json(
          {
            type: 'https://api.return.app/errors/validation-failed',
            title: 'Validation Failed',
            status: 400,
            detail: 'The request contains invalid data.',
            instance: '/v1/users/me/password',
            timestamp: '2026-10-28T10:00:00Z',
            requestId: 'req-mock',
            errors: [{ field: 'newPassword', code: 'INVALID_FORMAT', message: 'Password must…' }],
          },
          { status: 400 },
        ),
      ),
    );

    renderScreen();
    fireEvent.changeText(screen.getByTestId('currentPassword-input'), 'Current2026!');
    fireEvent.changeText(screen.getByTestId('newPassword-input'), 'Retour2026!');
    fireEvent.changeText(screen.getByTestId('confirmNewPassword-input'), 'Retour2026!');
    fireEvent.press(screen.getByTestId('changePassword-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('newPassword-error').props.children).toContain('@ $ ! % * ? &');
    });
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('still shows a message when the API validation error concerns no displayed field', async () => {
    server.use(
      http.patch('http://localhost:3000/v1/users/me/password', () =>
        HttpResponse.json(
          {
            type: 'https://api.return.app/errors/validation-failed',
            title: 'Validation Failed',
            status: 400,
            detail: 'The request contains invalid data.',
            instance: '/v1/users/me/password',
            timestamp: '2026-10-28T10:00:00Z',
            requestId: 'req-mock',
            errors: [{ field: 'id', code: 'INVALID_UUID', message: 'x' }],
          },
          { status: 400 },
        ),
      ),
    );

    renderScreen();
    fireEvent.changeText(screen.getByTestId('currentPassword-input'), 'Current2026!');
    fireEvent.changeText(screen.getByTestId('newPassword-input'), 'Retour2026!');
    fireEvent.changeText(screen.getByTestId('confirmNewPassword-input'), 'Retour2026!');
    fireEvent.press(screen.getByTestId('changePassword-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeTruthy();
    });
  });
});
