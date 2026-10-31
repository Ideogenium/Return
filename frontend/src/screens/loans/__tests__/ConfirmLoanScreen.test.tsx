import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import { ConfirmLoanScreen } from '../ConfirmLoanScreen';
import { useLoanStore } from '../../../stores/useLoanStore';
import type { LoanStackParamList } from '../../../navigation/types';

const Stack = createNativeStackNavigator<LoanStackParamList>();
const LOAN_ID = '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d';
const REASON = 'Je n’ai jamais emprunté cet objet';

function DummyList() {
  return <Text>LoanList</Text>;
}

function renderConfirmScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="ConfirmLoan">
          <Stack.Screen name="LoanList" component={DummyList} />
          <Stack.Screen
            name="ConfirmLoan"
            component={ConfirmLoanScreen}
            initialParams={{ id: LOAN_ID }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useLoanStore.getState().reset();
});
afterAll(() => server.close());

describe('ConfirmLoanScreen', () => {
  it('keeps the contest dialog and the typed reason when contesting fails', async () => {
    server.use(
      http.get('http://localhost:3000/v1/loans/:id', ({ params }) =>
        HttpResponse.json(
          {
            id: params.id,
            item: {
              id: 'i1',
              name: 'Perceuse',
              category: 'TOOLS',
              createdAt: '2026-02-10T10:00:00Z',
            },
            lender: { id: 'l1', firstName: 'John', lastName: 'Doe', profilePicture: null },
            borrower: { id: 'b1', firstName: 'Marie', lastName: 'Dupont', email: 'm@example.com' },
            status: 'PENDING_CONFIRMATION',
            returnDate: '2026-12-15',
            confirmationDate: null,
            returnedDate: null,
            notes: null,
            contestReason: null,
            createdAt: '2026-10-20T10:00:00Z',
            updatedAt: '2026-10-20T10:00:00Z',
          },
          { status: 200 },
        ),
      ),
      http.post('http://localhost:3000/v1/loans/:id/contest', () =>
        HttpResponse.json(
          {
            type: 'https://api.return.app/errors/internal-server-error',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Unexpected error.',
            instance: `/v1/loans/${LOAN_ID}/contest`,
            timestamp: '2026-10-28T10:00:00Z',
            requestId: 'req-mock',
          },
          { status: 500 },
        ),
      ),
    );
    renderConfirmScreen();
    await waitFor(() => {
      expect(screen.getByTestId('contest-btn')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('contest-btn'));
    fireEvent.changeText(screen.getByTestId('contest-reason-input'), REASON);

    fireEvent.press(screen.getByTestId('submit-contest-btn'));

    // The error is shown inside the dialog, where the user is looking.
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog-error')).toBeTruthy();
    });
    expect(screen.getByTestId('confirmation-dialog')).toBeTruthy();
    expect(screen.getByTestId('contest-reason-input').props.value).toBe(REASON);
  });
});
