import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Stack racine (wraps tabs + écrans globaux)
export type RootAppStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList> | undefined;
  NotificationList: undefined;
};

// Tabs principaux
export type AppTabParamList = {
  LoanTab: NavigatorScreenParams<LoanStackParamList> | undefined;
  BorrowerTab: NavigatorScreenParams<BorrowerStackParamList> | undefined;
  ItemTab: undefined;
  ProfileTab: undefined;
};

// Stack Profile (anciennement AppStackParamList)
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
  Settings: undefined;
  LoanHistory: undefined;
  // Registered in the Profile stack so that going back from a loan opened from the
  // history returns to the history list (not to the Loans tab).
  LoanDetail: { id: string };
};

// Backward compat — les écrans existants utilisent NativeStackScreenProps<AppStackParamList, ...>
export type AppStackParamList = ProfileStackParamList;

// Stack Items
export type ItemStackParamList = {
  ItemList: undefined;
  CreateItem: undefined;
  ItemDetail: { id: string };
  EditItem: { id: string };
};

// Stack Loans
export type LoanStackParamList = {
  LoanList: undefined;
  CreateLoan: undefined;
  LoanDetail: { id: string };
  ConfirmLoan: { id: string };
};

// Stack Borrowers
export type BorrowerStackParamList = {
  BorrowerList: undefined;
  CreateBorrower: undefined;
  BorrowerDetail: { id: string };
  EditBorrower: { id: string };
  SearchBorrower: undefined;
  BorrowerInvitations: undefined;
  SentInvitations: undefined;
};
