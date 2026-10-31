import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { Text } from 'react-native';
import { server } from '../../../../__mocks__/server';
import { CreateLoanScreen } from '../CreateLoanScreen';
import { useItemStore } from '../../../stores/useItemStore';
import { useBorrowerStore } from '../../../stores/useBorrowerStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LoanStackParamList } from '../../../navigation/types';

const Stack = createNativeStackNavigator<LoanStackParamList>();

function DummyLoanList() {
  return <Text>LoanListScreen</Text>;
}

function DummyLoanDetail() {
  return <Text>LoanDetailScreen</Text>;
}

function DummyConfirmLoan() {
  return <Text>ConfirmLoanScreen</Text>;
}

function renderCreateLoanScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="CreateLoan" component={CreateLoanScreen} />
          <Stack.Screen name="LoanList" component={DummyLoanList} />
          <Stack.Screen name="LoanDetail" component={DummyLoanDetail} />
          <Stack.Screen name="ConfirmLoan" component={DummyConfirmLoan} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useItemStore.getState().reset();
  useBorrowerStore.getState().reset();
});
afterAll(() => server.close());

describe('CreateLoanScreen', () => {
  it('should call fetchItems with { available: true } on mount', async () => {
    const fetchItemsSpy = jest.spyOn(useItemStore.getState(), 'fetchItems');

    renderCreateLoanScreen();

    await waitFor(() => {
      expect(fetchItemsSpy).toHaveBeenCalledWith({ available: true });
    });

    fetchItemsSpy.mockRestore();
  });
});
