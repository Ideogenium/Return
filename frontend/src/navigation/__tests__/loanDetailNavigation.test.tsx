import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigateToLoanDetail, navigationRef } from '../navigationRef';

// Real navigators shaped like the app (Tabs > LoanTab > LoanList | LoanDetail): the bug
// lives in how React Navigation builds a nested stack, which a mocked navigate cannot show.
const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const LoanStack = createNativeStackNavigator();

const Placeholder = () => <Text>screen</Text>;

function LoanNavigator() {
  return (
    <LoanStack.Navigator>
      <LoanStack.Screen name="LoanList" component={Placeholder} />
      <LoanStack.Screen name="LoanDetail" component={Placeholder} />
    </LoanStack.Navigator>
  );
}

function Tabs({ initialTab }: { initialTab: string }) {
  return (
    <Tab.Navigator initialRouteName={initialTab}>
      <Tab.Screen name="LoanTab" component={LoanNavigator} />
      <Tab.Screen name="ProfileTab" component={Placeholder} />
    </Tab.Navigator>
  );
}

function renderApp(initialTab: string) {
  const TabsScreen = () => <Tabs initialTab={initialTab} />;
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator>
          <RootStack.Screen name="Tabs" component={TabsScreen} />
          <RootStack.Screen name="NotificationList" component={Placeholder} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

/** Route names of the loan stack, bottom to top. */
function loanStackRoutes(): string[] {
  const root = navigationRef.getRootState();
  const tabs = root.routes.find((r) => r.name === 'Tabs')?.state as NavigationState | undefined;
  const loanTab = tabs?.routes.find((r) => r.name === 'LoanTab')?.state as
    | NavigationState
    | undefined;
  return loanTab?.routes.map((r) => r.name) ?? [];
}

describe('navigateToLoanDetail on real navigators', () => {
  // Regression: a notification tapped while the loan tab had never been opened made the
  // detail the only screen of the stack — no back button, no way back to the list.
  it('puts the loan list under the detail when the loan tab was never opened', () => {
    renderApp('ProfileTab');

    act(() => navigateToLoanDetail('loan-123'));

    expect(loanStackRoutes()).toEqual(['LoanList', 'LoanDetail']);
  });

  it('pushes the detail over the list when the loan tab is already open', () => {
    renderApp('LoanTab');

    act(() => navigateToLoanDetail('loan-123'));

    expect(loanStackRoutes()).toEqual(['LoanList', 'LoanDetail']);
  });
});
