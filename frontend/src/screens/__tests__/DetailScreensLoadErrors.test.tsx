import type { ComponentType } from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import i18n from '../../config/i18n.config';
import { LoanDetailScreen } from '../loans/LoanDetailScreen';
import { ConfirmLoanScreen } from '../loans/ConfirmLoanScreen';
import { ItemDetailScreen } from '../items/ItemDetailScreen';
import { BorrowerDetailScreen } from '../borrowers/BorrowerDetailScreen';
import { EditItemScreen } from '../items/EditItemScreen';
import { EditBorrowerScreen } from '../borrowers/EditBorrowerScreen';
import { useLoanStore } from '../../stores/useLoanStore';
import { useItemStore } from '../../stores/useItemStore';
import { useBorrowerStore } from '../../stores/useBorrowerStore';
import type { ProblemDetails } from '../../types/api.types';

// One rule for every detail screen:
// - full-screen error only when nothing is displayable AND this screen's own load failed;
// - an entity already displayed stays displayed when a refresh fails, with a visible error;
// - an error left in the store by another screen is never shown.

const API = 'http://localhost:3000/v1';
const LOAN_ID = '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d';
const ITEM_ID = '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d';
const BORROWER_ID = '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f';

const leftoverError: ProblemDetails = {
  type: 'https://api.return.app/errors/internal-server-error',
  title: 'Internal Server Error',
  status: 500,
  detail: 'Left by another screen.',
  instance: '/v1/elsewhere',
  timestamp: '2026-10-28T10:00:00Z',
  requestId: 'req-old',
};

// A load that never settles: whatever the store still holds is what the screen renders.
const pending = () => new Promise<never>(() => {});

// Initial store states (actions included), restored after each test.
const loanDefaults = useLoanStore.getState();
const itemDefaults = useItemStore.getState();
const borrowerDefaults = useBorrowerStore.getState();

interface DetailCase {
  name: string;
  route: string;
  Screen: ComponentType<object>;
  id: string;
  url: string;
  /** Loads the entity into the store (default MSW handlers), as a previous visit would. */
  preload: () => Promise<unknown>;
  setLeftover: () => void;
  reset: () => void;
  fullErrorTestId: string;
  /** Proof that the displayed entity is still on screen. */
  contentTestId: string;
}

const CASES: DetailCase[] = [
  {
    name: 'LoanDetailScreen',
    route: 'LoanDetail',
    Screen: LoanDetailScreen as unknown as ComponentType<object>,
    id: LOAN_ID,
    url: `${API}/loans/:id`,
    preload: () => useLoanStore.getState().fetchLoan(LOAN_ID),
    setLeftover: () =>
      useLoanStore.setState({ selectedLoan: null, error: leftoverError, fetchLoan: pending }),
    reset: () => useLoanStore.setState(loanDefaults),
    fullErrorTestId: 'loan-error',
    contentTestId: 'loan-detail',
  },
  {
    name: 'ConfirmLoanScreen',
    route: 'ConfirmLoan',
    Screen: ConfirmLoanScreen as unknown as ComponentType<object>,
    id: LOAN_ID,
    url: `${API}/loans/:id`,
    preload: () => useLoanStore.getState().fetchLoan(LOAN_ID),
    setLeftover: () =>
      useLoanStore.setState({ selectedLoan: null, error: leftoverError, fetchLoan: pending }),
    reset: () => useLoanStore.setState(loanDefaults),
    fullErrorTestId: 'loan-error',
    contentTestId: 'confirmation-dialog',
  },
  {
    name: 'ItemDetailScreen',
    route: 'ItemDetail',
    Screen: ItemDetailScreen as unknown as ComponentType<object>,
    id: ITEM_ID,
    url: `${API}/items/:id`,
    preload: () => useItemStore.getState().fetchItem(ITEM_ID),
    setLeftover: () =>
      useItemStore.setState({ selectedItem: null, error: leftoverError, fetchItem: pending }),
    reset: () => useItemStore.setState(itemDefaults),
    fullErrorTestId: 'item-error',
    contentTestId: 'item-detail',
  },
  {
    name: 'BorrowerDetailScreen',
    route: 'BorrowerDetail',
    Screen: BorrowerDetailScreen as unknown as ComponentType<object>,
    id: BORROWER_ID,
    url: `${API}/borrowers/:id`,
    preload: () => useBorrowerStore.getState().fetchBorrower(BORROWER_ID),
    setLeftover: () =>
      useBorrowerStore.setState({
        selectedBorrower: null,
        error: leftoverError,
        fetchBorrower: pending,
      }),
    reset: () => useBorrowerStore.setState(borrowerDefaults),
    fullErrorTestId: 'borrower-error',
    contentTestId: 'borrower-detail',
  },
  {
    name: 'EditItemScreen',
    route: 'EditItem',
    Screen: EditItemScreen as unknown as ComponentType<object>,
    id: ITEM_ID,
    url: `${API}/items/:id`,
    preload: () => useItemStore.getState().fetchItem(ITEM_ID),
    setLeftover: () =>
      useItemStore.setState({ selectedItem: null, error: leftoverError, fetchItem: pending }),
    reset: () => useItemStore.setState(itemDefaults),
    fullErrorTestId: 'item-error',
    contentTestId: 'edit-item',
  },
  {
    name: 'EditBorrowerScreen',
    route: 'EditBorrower',
    Screen: EditBorrowerScreen as unknown as ComponentType<object>,
    id: BORROWER_ID,
    url: `${API}/borrowers/:id`,
    preload: () => useBorrowerStore.getState().fetchBorrower(BORROWER_ID),
    setLeftover: () =>
      useBorrowerStore.setState({
        selectedBorrower: null,
        error: leftoverError,
        fetchBorrower: pending,
      }),
    reset: () => useBorrowerStore.setState(borrowerDefaults),
    fullErrorTestId: 'borrower-error',
    contentTestId: 'edit-borrower',
  },
];

const Stack = createNativeStackNavigator();

function renderScreen(c: DetailCase) {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name={c.route} component={c.Screen} initialParams={{ id: c.id }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>,
  );
}

const failWithNetworkError = (url: string) => server.use(http.get(url, () => HttpResponse.error()));

beforeAll(() => {
  server.listen();
  return i18n.changeLanguage('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe.each(CASES)('$name — load errors', (c) => {
  afterEach(() => act(() => c.reset()));

  it('keeps the displayed entity and shows a non-blocking error when a refresh fails', async () => {
    await act(() => c.preload());
    failWithNetworkError(c.url);

    renderScreen(c);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('errors.networkError'))).toBeTruthy();
    });
    expect(screen.getByTestId(c.contentTestId)).toBeTruthy();
    expect(screen.queryByTestId(c.fullErrorTestId)).toBeNull();
  });

  it('shows the full-screen error with a way back when nothing could be loaded', async () => {
    failWithNetworkError(c.url);

    renderScreen(c);

    await waitFor(() => {
      expect(screen.getByTestId(c.fullErrorTestId)).toBeTruthy();
    });
    expect(screen.getByText(i18n.t('common.back'))).toBeTruthy();
  });

  it('never shows an error left in the store by another screen', () => {
    act(() => c.setLeftover());

    renderScreen(c);

    expect(screen.queryByTestId(c.fullErrorTestId)).toBeNull();
  });
});

describe.each([
  {
    name: 'EditItemScreen',
    c: () => CASES.find((x) => x.name === 'EditItemScreen')!,
    input: 'name-input',
    submit: 'item-submit-btn',
    patchUrl: `${API}/items/:id`,
  },
  {
    name: 'EditBorrowerScreen',
    c: () => CASES.find((x) => x.name === 'EditBorrowerScreen')!,
    input: 'firstName-input',
    submit: 'borrower-submit-btn',
    patchUrl: `${API}/borrowers/:id`,
  },
])('$name — saving', ({ c, input, submit, patchUrl }) => {
  afterEach(() => act(() => c().reset()));

  it('keeps the form and what the user typed when saving fails', async () => {
    await act(() => c().preload());
    server.use(http.patch(patchUrl, () => HttpResponse.error()));

    renderScreen(c());
    await waitFor(() => {
      expect(screen.getByTestId(input)).toBeTruthy();
    });
    fireEvent.changeText(screen.getByTestId(input), 'Typed by the user');
    fireEvent.press(screen.getByTestId(submit));

    // Save errors go through the screen's own message (unknownError for a network failure).
    await waitFor(() => {
      expect(screen.getByText(i18n.t('errors.unknownError'))).toBeTruthy();
    });
    expect(screen.getByTestId(input).props.value).toBe('Typed by the user');
  });
});
