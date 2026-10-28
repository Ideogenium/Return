import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { http, HttpResponse } from 'msw';
import { DeleteAccountScreen } from '../DeleteAccountScreen';
import { useAuthStore } from '../../../stores/useAuthStore';
import { clearTokens } from '../../../utils/storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function renderDeleteScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
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

describe('DeleteAccountScreen', () => {
  it('should render the delete form with warning', () => {
    renderDeleteScreen();

    expect(screen.getByTestId('password-input')).toBeTruthy();
    expect(screen.getByTestId('confirmationText-input')).toBeTruthy();
    expect(screen.getByTestId('delete-btn')).toBeTruthy();
  });

  it('should show validation error for wrong confirmation text', async () => {
    renderDeleteScreen();

    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.changeText(screen.getByTestId('confirmationText-input'), 'wrong text');
    fireEvent.press(screen.getByTestId('delete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirmationText-error')).toBeTruthy();
    });
  });

  it('should show API error on 409 (active loans)', async () => {
    server.use(
      http.delete('http://localhost:3000/v1/users/me', () => {
        return HttpResponse.json(
          {
            type: 'https://api.return.app/errors/active-loans-exist',
            title: 'Active Loans Exist',
            status: 409,
            detail: 'Cannot delete account while active loans exist.',
            instance: '/v1/users/me',
            timestamp: '2026-02-18T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 409 },
        );
      }),
    );

    renderDeleteScreen();

    fireEvent.changeText(screen.getByTestId('password-input'), 'P@ssw0rd!');
    fireEvent.changeText(screen.getByTestId('confirmationText-input'), 'DELETE MY ACCOUNT');
    fireEvent.press(screen.getByTestId('delete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('api-error')).toBeTruthy();
    });
  });

  it('only requires the current password to be filled in: it is verified by the API, not created', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('http://localhost:3000/v1/users/me', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderDeleteScreen();

    fireEvent.changeText(screen.getByTestId('password-input'), 'short');
    fireEvent.changeText(screen.getByTestId('confirmationText-input'), 'DELETE MY ACCOUNT');
    fireEvent.press(screen.getByTestId('delete-btn'));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    expect(screen.queryByTestId('password-error')).toBeNull();
  });
});
