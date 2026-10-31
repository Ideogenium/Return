import { render, screen, waitFor, act, within } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { View } from 'react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../__mocks__/server';
import { LoanDetailScreen } from '../LoanDetailScreen';
import { useLoanStore } from '../../../stores/useLoanStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useReminderStore } from '../../../stores/useReminderStore';

const API_BASE = 'http://localhost:3000/v1';
const LENDER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const LOAN_A = 'loan-a';
const LOAN_B = 'loan-b';

const Tab = createBottomTabNavigator();
const LoansStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// LoanDetail is mounted in two tab stacks (Loans and Profile > History), like in the app
function LoansTab() {
  return (
    <View testID="tab-loans">
      <LoansStack.Navigator>
        <LoansStack.Screen
          name="LoanDetail"
          component={LoanDetailScreen as never}
          initialParams={{ id: LOAN_A }}
        />
      </LoansStack.Navigator>
    </View>
  );
}

function ProfileTab() {
  return (
    <View testID="tab-profile">
      <ProfileStack.Navigator>
        <ProfileStack.Screen
          name="LoanDetail"
          component={LoanDetailScreen as never}
          initialParams={{ id: LOAN_B }}
        />
      </ProfileStack.Navigator>
    </View>
  );
}

function buildLoan(id: string, status: string, itemName: string) {
  return {
    id,
    item: {
      id: `item-${id}`,
      name: itemName,
      category: 'TOOLS',
      createdAt: '2026-02-10T10:00:00Z',
    },
    lender: { id: LENDER_ID, firstName: 'John', lastName: 'Doe' },
    borrower: { id: 'b-1', firstName: 'Marie', lastName: 'Dupont' },
    status,
    returnDate: '2026-04-15',
    confirmationDate: '2026-02-02T10:00:00Z',
    returnedDate: null,
    notes: null,
    contestReason: null,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-02T10:00:00Z',
  };
}

const hidden = { includeHiddenElements: true };
const inTab = (testID: string) => within(screen.getByTestId(testID, hidden));

beforeAll(() => server.listen());
beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: LENDER_ID,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'LENDER' as const,
      profilePicture: null,
      createdAt: '2026-02-01T10:00:00Z',
      lastLoginAt: '2026-02-18T08:00:00Z',
    },
  });
});
afterEach(() => {
  server.resetHandlers();
  useLoanStore.getState().reset();
  useReminderStore.getState().reset();
  useAuthStore.setState({ user: null, accessToken: null });
});
afterAll(() => server.close());

describe('LoanDetailScreen mounted in two tab stacks', () => {
  it('should never show the data or the actions of another loan when coming back to a tab', async () => {
    let holdLoanA = false;
    let releaseLoanA: () => void = () => {};
    const loanAGate = new Promise<void>((resolve) => {
      releaseLoanA = resolve;
    });
    const deleteCalls: string[] = [];
    server.use(
      http.get(`${API_BASE}/loans/:id`, async ({ params }) => {
        if (params.id === LOAN_A && holdLoanA) await loanAGate;
        return HttpResponse.json(
          params.id === LOAN_A
            ? buildLoan(LOAN_A, 'ACTIVE', 'Item A')
            : buildLoan(LOAN_B, 'NOT_RETURNED', 'Item B'),
        );
      }),
      http.delete(`${API_BASE}/loans/:id`, ({ params }) => {
        deleteCalls.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(
      <PaperProvider>
        <NavigationContainer ref={navigationRef}>
          <Tab.Navigator screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Loans" component={LoansTab} />
            <Tab.Screen name="Profile" component={ProfileTab} />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>,
    );
    await waitFor(() => expect(inTab('tab-loans').getByText('Item A', hidden)).toBeTruthy());

    // The lender opens loan B from the profile tab: the global store now holds B
    act(() => navigationRef.navigate('Profile' as never));
    await waitFor(() => expect(inTab('tab-profile').getByText('Item B', hidden)).toBeTruthy());

    // Back on the loans tab while loan A is still being reloaded
    holdLoanA = true;
    act(() => navigationRef.navigate('Loans' as never));

    // Screen A must neither show B nor offer its actions (delete would target A)
    expect(inTab('tab-loans').queryByText('Item B', hidden)).toBeNull();
    expect(inTab('tab-loans').queryByTestId('delete-loan-btn', hidden)).toBeNull();

    await act(async () => {
      releaseLoanA();
    });
    await waitFor(() => expect(inTab('tab-loans').getByText('Item A', hidden)).toBeTruthy());
    expect(inTab('tab-loans').queryByText('Item B', hidden)).toBeNull();
    expect(deleteCalls).toEqual([]);
  });

  it('should only pass the reminders of the displayed loan to the timeline', async () => {
    server.use(
      http.get(`${API_BASE}/loans/:id`, ({ params }) =>
        HttpResponse.json(buildLoan(String(params.id), 'ACTIVE', `Item ${params.id}`)),
      ),
    );
    render(
      <PaperProvider>
        <NavigationContainer ref={navigationRef}>
          <Tab.Navigator screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Loans" component={LoansTab} />
            <Tab.Screen name="Profile" component={ProfileTab} />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>,
    );
    await waitFor(() =>
      expect(inTab('tab-loans').getByText('Reminder before due date', hidden)).toBeTruthy(),
    );

    // Reminder store switches to loan B while the loans tab is unfocused
    act(() => navigationRef.navigate('Profile' as never));
    await waitFor(() => expect(useReminderStore.getState().loanId).toBe(LOAN_B));

    expect(inTab('tab-loans').queryByText('Reminder before due date', hidden)).toBeNull();
  });
});
