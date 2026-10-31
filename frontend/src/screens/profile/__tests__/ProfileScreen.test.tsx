import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { server } from '../../../../__mocks__/server';
import { ProfileScreen } from '../ProfileScreen';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import type { ProfileStackParamList } from '../../../navigation/types';
import i18n from '../../../config/i18n.config';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { resetFileSystemMock, setFileSize } from '../../../../__mocks__/expoFileSystemMock';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Real store actions, captured before any test replaces them.
const authDefaults = useAuthStore.getState();

function DummyHistory() {
  return <Text>HistoryScreen</Text>;
}

function renderProfile() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Profile">
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="LoanHistory" component={DummyHistory} />
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
  act(() => {
    useAuthStore.getState().reset();
    useHistoryStore.getState().reset();
  });
});
afterAll(() => server.close());

describe('ProfileScreen', () => {
  it('reloads a missing profile without restoring the session, which would tear down the navigation', async () => {
    const hydrate = jest.fn(() => Promise.resolve());
    const refreshUser = jest.fn(() => Promise.resolve());
    act(() => useAuthStore.setState({ user: null, hydrate, refreshUser }));

    renderProfile();

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

  describe('with a signed-in user', () => {
    beforeEach(() => {
      act(() =>
        useAuthStore.setState({
          user: {
            id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'LENDER',
            profilePicture: null,
            createdAt: '2026-02-01T10:00:00Z',
            lastLoginAt: '2026-02-18T08:00:00Z',
          },
          isLoading: false,
        }),
      );
    });

    it('should open the loan history when the history button is pressed', async () => {
      renderProfile();

      fireEvent.press(await screen.findByTestId('history-btn'));

      await waitFor(() => expect(screen.getByText('HistoryScreen')).toBeTruthy());
    });

    it('should send an avatar scaled down to 1024 px, well under the 2 MB avatar limit', async () => {
      const updateAvatar = jest.fn().mockResolvedValue(undefined);
      act(() => useAuthStore.setState({ updateAvatar }));
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///tmp/IMG_0002.HEIC', width: 4032, height: 3024 }],
      });
      const manipulate = ImageManipulator.manipulate as unknown as jest.Mock;
      manipulate.mockClear();
      renderProfile();

      fireEvent.press(await screen.findByTestId('photo-picker-btn'));
      fireEvent.press(await screen.findByTestId('photo-picker-gallery'));

      await waitFor(() => expect(updateAvatar).toHaveBeenCalled());
      expect(manipulate.mock.results[0]!.value.resize).toHaveBeenCalledWith({ width: 1024 });
      act(() => useAuthStore.setState({ updateAvatar: authDefaults.updateAvatar }));
    });

    it('should send a PNG avatar over the 2 MB avatar limit as JPEG', async () => {
      const updateAvatar = jest.fn().mockResolvedValue(undefined);
      act(() => useAuthStore.setState({ updateAvatar }));
      // Node's FormData (Jest) stringifies the React Native file part: read it from append.
      const append = jest.spyOn(FormData.prototype, 'append');
      setFileSize('file:///tmp/manipulated/avatar-cutout.png', 3 * 1024 * 1024);
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          { uri: 'file:///tmp/avatar-cutout.png', mimeType: 'image/png', width: 800, height: 800 },
        ],
      });
      renderProfile();

      fireEvent.press(await screen.findByTestId('photo-picker-btn'));
      fireEvent.press(await screen.findByTestId('photo-picker-gallery'));

      await waitFor(() => expect(updateAvatar).toHaveBeenCalled());
      expect(append).toHaveBeenCalledWith(
        'avatar',
        expect.objectContaining({ type: 'image/jpeg', name: 'photo.jpg' }),
      );
      append.mockRestore();
      resetFileSystemMock();
      act(() => useAuthStore.setState({ updateAvatar: authDefaults.updateAvatar }));
    });
  });
});
