import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { server } from '../../../../__mocks__/server';
import { http, HttpResponse } from 'msw';
import { Text } from 'react-native';
import { BorrowerDetailScreen } from '../BorrowerDetailScreen';
import { BorrowerListScreen } from '../BorrowerListScreen';
import { useBorrowerStore } from '../../../stores/useBorrowerStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BorrowerStackParamList } from '../../../navigation/types';
import i18n from '../../../config/i18n.config';

const Stack = createNativeStackNavigator<BorrowerStackParamList>();

function DummyCreateBorrower() {
  return <Text>CreateBorrowerScreen</Text>;
}

function DummyEditBorrower() {
  return <Text>EditBorrowerScreen</Text>;
}

function renderDetailScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="BorrowerDetail"
            component={BorrowerDetailScreen}
            initialParams={{ id: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f' }}
          />
          <Stack.Screen name="BorrowerList" component={BorrowerListScreen} />
          <Stack.Screen name="CreateBorrower" component={DummyCreateBorrower} />
          <Stack.Screen name="EditBorrower" component={DummyEditBorrower} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useBorrowerStore.getState().reset();
});
afterAll(() => server.close());

describe('BorrowerDetailScreen', () => {
  it('should render borrower details', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('borrower-detail')).toBeTruthy();
    });

    expect(screen.getByText('Marie Dupont')).toBeTruthy();
    expect(screen.getByText('marie.dupont@example.com')).toBeTruthy();
  });

  it('shows a translated label instead of the placeholder email of a deleted account (FIX-22)', async () => {
    server.use(
      http.get('http://localhost:3000/v1/borrowers/:id', ({ params }) =>
        HttpResponse.json({
          id: params.id,
          firstName: 'Marie',
          lastName: 'Dupont',
          email: `deleted+${String(params.id)}.a1b2c3d4e5f60718@deleted.invalid`,
          phoneNumber: null,
          userId: null,
          accountDeleted: true,
          statistics: {
            totalLoans: 1,
            returnedOnTime: 1,
            returnedLate: 0,
            notReturned: 0,
            averageReturnDelay: null,
            trustScore: 100,
          },
        }),
      ),
    );

    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByText(i18n.t('loans.deletedAccount'))).toBeTruthy();
    });
    expect(screen.getByText('Marie Dupont')).toBeTruthy();
    expect(screen.queryByText(/deleted\.invalid/)).toBeNull();
  });

  it('should show delete confirmation dialog', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-borrower-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-borrower-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeTruthy();
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
      expect(screen.getByTestId('cancel-delete-btn')).toBeTruthy();
    });
  });

  it('should delete and go back on confirm', async () => {
    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-borrower-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-borrower-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('confirm-delete-btn'));

    // goBack() on a single-screen stack unmounts => detail disappears
    await waitFor(() => {
      expect(screen.queryByTestId('borrower-detail')).toBeNull();
    });
  });

  it('should show API error on 409 delete', async () => {
    server.use(
      http.delete('http://localhost:3000/v1/borrowers/:id', () => {
        return HttpResponse.json(
          {
            type: 'https://api.return.app/errors/active-loans-exist',
            title: 'Active Loans Exist',
            status: 409,
            detail: 'Cannot delete borrower with active loans.',
            instance: '/borrowers/5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
            timestamp: '2026-02-22T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 409 },
        );
      }),
    );

    renderDetailScreen();

    await waitFor(() => {
      expect(screen.getByTestId('delete-borrower-btn')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-borrower-btn'));

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

    it('keeps the borrower on screen while it is being deleted', async () => {
      const { opened, release } = gate();
      server.use(
        http.delete('http://localhost:3000/v1/borrowers/:id', async () => {
          await opened;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderDetailScreen();
      await waitFor(() => {
        expect(screen.getByTestId('delete-borrower-btn')).toBeTruthy();
      });
      fireEvent.press(screen.getByTestId('delete-borrower-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('confirm-delete-btn'));

      await waitFor(() => {
        expect(useBorrowerStore.getState().isLoading).toBe(true);
      });
      expect(screen.queryByTestId('loading')).toBeNull();
      expect(screen.getByTestId('borrower-detail')).toBeTruthy();
      release();
    });
  });
});
