import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { Text } from 'react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import { HistoryScreen } from '../HistoryScreen';
import { useHistoryStore } from '../../../stores/useHistoryStore';
import type { ProfileStackParamList } from '../../../navigation/types';

const API_BASE = 'http://localhost:3000/v1';
const Stack = createNativeStackNavigator<ProfileStackParamList>();

function DummyLoanDetail({ navigation }: { navigation: { goBack: () => void } }) {
  return (
    <>
      <Text>LoanDetailScreen</Text>
      <Text onPress={() => navigation.goBack()} testID="dummy-back">
        back
      </Text>
    </>
  );
}

function renderHistoryScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="LoanHistory">
          <Stack.Screen name="LoanHistory" component={HistoryScreen} />
          <Stack.Screen name="LoanDetail" component={DummyLoanDetail} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

const serverError = () =>
  HttpResponse.json(
    {
      type: 'https://api.return.app/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Boom',
      instance: '/history/loans',
      timestamp: '2026-06-23T10:00:00Z',
      requestId: 'req-mock',
    },
    { status: 500 },
  );

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useHistoryStore.getState().reset();
});
afterAll(() => server.close());

describe('HistoryScreen', () => {
  it('should render the archived loans, newest first', async () => {
    renderHistoryScreen();

    await waitFor(() => {
      expect(screen.getByTestId('history-list')).toBeTruthy();
      expect(screen.getByTestId('loan-card-history-loan-1')).toBeTruthy();
    });
    expect(screen.getByText('Archived item 1')).toBeTruthy();
  });

  it('should show a loader while the first page is loading', async () => {
    renderHistoryScreen();

    expect(screen.getByTestId('history-loading')).toBeTruthy();

    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
  });

  it('should render the empty state when there is no archived loan', async () => {
    server.use(
      http.get(`${API_BASE}/history/loans`, () =>
        HttpResponse.json({
          data: [],
          pagination: {
            currentPage: 1,
            itemsPerPage: 20,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
      ),
    );

    renderHistoryScreen();

    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeTruthy());
  });

  it('should render the error state and retry on press', async () => {
    server.use(http.get(`${API_BASE}/history/loans`, serverError));
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-error')).toBeTruthy());
    server.resetHandlers();

    fireEvent.press(screen.getByTestId('history-retry'));

    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('should keep the filter chips visible when the list is in error', async () => {
    server.use(http.get(`${API_BASE}/history/loans`, serverError));

    renderHistoryScreen();

    await waitFor(() => expect(screen.getByTestId('history-error')).toBeTruthy());
    expect(screen.getByTestId('history-filter-chip-RETURNED')).toBeTruthy();
  });

  it('should only list loans of the selected status when a filter chip is pressed', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());

    fireEvent.press(screen.getByTestId('history-filter-chip-RETURNED'));

    await waitFor(() => {
      // history-loan-2 is NOT_RETURNED in the mock dataset, history-loan-5 is RETURNED
      expect(screen.queryByTestId('loan-card-history-loan-2')).toBeNull();
      expect(screen.getByTestId('loan-card-history-loan-5')).toBeTruthy();
    });
    expect(useHistoryStore.getState().statusFilter).toBe('RETURNED');
  });

  it('should clear the filter when the "all" chip is pressed', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    fireEvent.press(screen.getByTestId('history-filter-chip-RETURNED'));
    await waitFor(() => expect(screen.queryByTestId('loan-card-history-loan-2')).toBeNull());

    fireEvent.press(screen.getByTestId('history-filter-chip-ALL'));

    await waitFor(() => expect(screen.getByTestId('loan-card-history-loan-2')).toBeTruthy());
    expect(useHistoryStore.getState().statusFilter).toBeNull();
  });

  it('should load the next page when the end of the list is reached', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    expect(useHistoryStore.getState().loans).toHaveLength(20);

    fireEvent(screen.getByTestId('history-list'), 'endReached');

    await waitFor(() => expect(useHistoryStore.getState().loans).toHaveLength(25));
  });

  it('should offer a retry in the footer when the next page fails', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    server.use(http.get(`${API_BASE}/history/loans`, serverError));
    fireEvent(screen.getByTestId('history-list'), 'endReached');
    await waitFor(() => expect(screen.getByTestId('history-more-error')).toBeTruthy());
    server.resetHandlers();

    fireEvent.press(screen.getByTestId('history-more-retry'));

    await waitFor(() => expect(useHistoryStore.getState().loans).toHaveLength(25));
    expect(screen.queryByTestId('history-more-error')).toBeNull();
  });

  it('should navigate to the loan detail when a loan is pressed', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('loan-card-history-loan-1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('loan-card-history-loan-1'));

    await waitFor(() => expect(screen.getByText('LoanDetailScreen')).toBeTruthy());
  });

  it('should keep the loaded list and filter when coming back from the loan detail', async () => {
    renderHistoryScreen();
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    fireEvent.press(screen.getByTestId('history-filter-chip-RETURNED'));
    await waitFor(() => expect(screen.getByTestId('loan-card-history-loan-5')).toBeTruthy());
    fireEvent.press(screen.getByTestId('loan-card-history-loan-5'));
    await waitFor(() => expect(screen.getByText('LoanDetailScreen')).toBeTruthy());

    fireEvent.press(screen.getByTestId('dummy-back'));

    await waitFor(() => expect(screen.getByTestId('loan-card-history-loan-5')).toBeTruthy());
    expect(useHistoryStore.getState().statusFilter).toBe('RETURNED');
    expect(screen.queryByTestId('history-loading')).toBeNull();
  });
});
