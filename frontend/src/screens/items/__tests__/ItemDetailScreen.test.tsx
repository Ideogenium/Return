import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { http, HttpResponse } from 'msw';
import { Text } from 'react-native';
import { ItemDetailScreen } from '../ItemDetailScreen';
import { ItemListScreen } from '../ItemListScreen';
import { useItemStore } from '../../../stores/useItemStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ItemStackParamList } from '../../../navigation/types';

const Stack = createNativeStackNavigator<ItemStackParamList>();

function DummyCreateItem() {
  return <Text>CreateItemScreen</Text>;
}

function DummyEditItem() {
  return <Text>EditItemScreen</Text>;
}

function renderDetailScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen}
            initialParams={{ id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d' }}
          />
          <Stack.Screen name="ItemList" component={ItemListScreen} />
          <Stack.Screen name="CreateItem" component={DummyCreateItem} />
          <Stack.Screen name="EditItem" component={DummyEditItem} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useItemStore.getState().reset();
});
afterAll(() => server.close());

describe('ItemDetailScreen', () => {
  it('should render item details', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('item-detail')).toBeTruthy();
    });

    expect(screen.getByText('Perceuse Bosch')).toBeTruthy();
  });

  it('should show delete confirmation dialog', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-item-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-item-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeTruthy();
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
      expect(screen.getByTestId('cancel-delete-btn')).toBeTruthy();
    });
  });

  it('should delete and go back on confirm', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-item-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-item-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('item-detail')).toBeNull();
    });
  });

  it('should show API error on 409 delete', async () => {
    server.use(
      http.delete('http://localhost:3000/v1/items/:itemId', () => {
        return HttpResponse.json(
          {
            type: 'https://api.return.app/errors/item-currently-loaned',
            title: 'Item Currently Loaned',
            status: 409,
            detail: 'Cannot delete item while it is loaned.',
            instance: '/items/9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
            timestamp: '2026-02-25T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 409 },
        );
      }),
    );

    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-item-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-item-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('api-error')).toBeTruthy();
    });
  });

  describe('actions never unmount the screen', () => {
    /** A request that stays pending until `release()` is called. */
    function gate() {
      let release!: () => void;
      const opened = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { opened, release };
    }

    it('keeps the item on screen while it is being deleted', async () => {
      const { opened, release } = gate();
      server.use(
        http.delete('http://localhost:3000/v1/items/:itemId', async () => {
          await opened;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderDetailScreen();
      await waitFor(() => {
        expect(screen.getByTestId('delete-item-btn')).toBeTruthy();
      });
      fireEvent.press(screen.getByTestId('delete-item-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('confirm-delete-btn'));

      await waitFor(() => {
        expect(useItemStore.getState().isLoading).toBe(true);
      });
      expect(screen.queryByTestId('loading')).toBeNull();
      expect(screen.getByTestId('item-detail')).toBeTruthy();
      release();
    });
  });
});
