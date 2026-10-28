import { render, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { server } from '../../../../__mocks__/server';
import { ProfileScreen } from '../ProfileScreen';
import { useAuthStore } from '../../../stores/useAuthStore';

const Stack = createNativeStackNavigator();

beforeAll(() => server.listen());
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
});
