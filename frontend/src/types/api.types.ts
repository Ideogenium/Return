// Types conformes au contrat OpenAPI (docs/openapi.yaml)

// --- Utilisateur ---

export type UserRole = 'LENDER';

export interface UserSettings {
  pushNotificationsEnabled: boolean;
  reminderEnabled: boolean;
  language: 'fr' | 'en';
  timezone: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profilePicture?: string | null;
  phone?: string | null;
  settings?: UserSettings;
  createdAt: string;
  lastLoginAt?: string | null;
}

// --- Authentification ---

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: User;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

// --- Profil ---

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountDto {
  password: string;
  confirmationText: 'DELETE MY ACCOUNT';
}

// --- Emprunteurs (Borrowers) ---

export interface BorrowerStatistics {
  totalLoans: number;
  returnedOnTime: number;
  returnedLate: number;
  notReturned: number;
  averageReturnDelay: number | null;
  // FIX-17: null = pas encore noté (aucun prêt résolu / contact non lié)
  trustScore: number | null;
}

// FIX-15: trustScore global de l'utilisateur courant en tant qu'emprunteur (agrégé tous prêteurs).
// Contrat backend GET /users/me/trust-score → TrustScoreService.GlobalTrustScore.
export interface GlobalTrustScore {
  // FIX-17: null = pas encore noté (aucun prêt résolu / contact non lié)
  trustScore: number | null;
  totalLoans: number;
  returnedOnTime: number;
  returnedLate: number;
  notReturned: number;
}

export interface Borrower {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  userId?: string | null;
  statistics?: BorrowerStatistics;
}

export interface CreateBorrowerDto {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
}

export interface UpdateBorrowerDto {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phoneNumber?: string | null;
}

// --- Objets (Items) ---

export type ItemCategory =
  | 'TOOLS'
  | 'ELECTRONICS'
  | 'BOOKS'
  | 'SPORTS'
  | 'KITCHEN'
  | 'GARDEN'
  | 'MONEY'
  | 'OTHER';

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  uploadedAt: string;
}

export interface Item {
  id: string;
  name: string;
  description?: string | null;
  category: ItemCategory;
  estimatedValue?: number | null;
  photos?: Photo[];
  createdAt: string;
}

export interface CreateItemDto {
  name: string;
  category: ItemCategory;
  description?: string | null;
  estimatedValue?: number | null;
}

export interface UpdateItemDto {
  name?: string;
  description?: string | null;
  category?: ItemCategory;
  estimatedValue?: number | null;
}

// --- Prêts (Loans) ---

export type LoanStatus =
  | 'PENDING_CONFIRMATION'
  | 'ACTIVE'
  | 'ACTIVE_BY_DEFAULT'
  | 'CONTESTED'
  | 'AWAITING_RETURN'
  | 'RETURNED'
  | 'NOT_RETURNED'
  | 'ABANDONED';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
}

export interface Loan {
  id: string;
  item: Item;
  lender: UserSummary;
  borrower: Borrower;
  status: LoanStatus;
  returnDate?: string | null;
  confirmationDate?: string | null;
  returnedDate?: string | null;
  notes?: string | null;
  contestReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanDto {
  item: CreateItemDto | string;
  borrowerId: string;
  returnDate?: string | null;
  notes?: string | null;
}

export interface UpdateLoanDto {
  returnDate?: string | null;
  notes?: string | null;
}

export interface UpdateLoanStatusDto {
  status: LoanStatus;
  notes?: string | null;
}

export interface ContestLoanDto {
  reason: string;
}

// --- Invitations de Contact ---

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface InvitationUserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ContactInvitation {
  id: string;
  status: InvitationStatus;
  senderUser: InvitationUserSummary;
  recipientEmail: string;
  recipientUser: InvitationUserSummary;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  alreadyContact: boolean;
  pendingInvitation?: boolean;
  pendingInvitationId?: string | null;
}

export interface SearchUsersDto {
  query: string;
  page?: number;
  limit?: number;
}

export interface SendInvitationDto {
  recipientEmail: string;
}

// --- Notifications ---

export type NotificationType =
  | 'LOAN_CREATED'
  | 'LOAN_CONFIRMED'
  | 'LOAN_AUTO_CONFIRMED'
  | 'LOAN_CONTESTED'
  | 'LOAN_RETURNED'
  | 'REMINDER_SENT'
  | 'REMINDER_RECEIVED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  relatedLoanId?: string | null;
  createdAt: string;
}

export interface RegisterDeviceTokenDto {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export interface UnregisterDeviceTokenDto {
  token: string;
}

// --- Rappels (Reminders) ---

export type ReminderType =
  | 'PREVENTIVE'
  | 'ON_DUE_DATE'
  | 'FIRST_OVERDUE'
  | 'SECOND_OVERDUE'
  | 'FINAL_OVERDUE';
export type ReminderStatus = 'SCHEDULED' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Reminder {
  id: string;
  loanId: string;
  type: ReminderType;
  status: ReminderStatus;
  scheduledFor: string;
  sentAt?: string | null;
  message?: string;
  channel: 'PUSH';
}

// --- Pagination ---

export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

// --- Historique & Statistiques ---

export interface HistoryOverview {
  totalLoans: number;
  activeLoans: number;
  returnedLoans: number;
  notReturnedLoans: number;
  contestedLoans: number;
  /** Prêts ouverts dont l'échéance est dépassée (aussi comptés dans activeLoans) */
  overdueLoans: number;
  averageReturnDelay: number;
}

export interface HistoryCategoryStats {
  category: string;
  count: number;
  totalValue: number | null;
}

export interface HistoryTopBorrower {
  borrower: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
  loanCount: number;
  // FIX-17: null = pas encore noté (aucun prêt résolu / contact non lié)
  trustScore: number | null;
}

export interface HistoryMostLoanedItem {
  item: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    estimatedValue: number | null;
    photos: Photo[];
    createdAt: string;
  };
  loanCount: number;
}

export interface HistoryStatistics {
  overview: HistoryOverview;
  byCategory: HistoryCategoryStats[];
  topBorrowers: HistoryTopBorrower[];
  mostLoanedItems: HistoryMostLoanedItem[];
}

// Statuts terminaux acceptés par GET /history/loans (enum du DTO backend)
export type HistoryLoanStatus = Extract<
  LoanStatus,
  'RETURNED' | 'NOT_RETURNED' | 'CONTESTED' | 'ABANDONED'
>;

export interface HistoryLoansParams {
  status?: HistoryLoanStatus;
  page?: number;
  limit?: number;
}

// --- Erreurs RFC 7807 ---

export type ValidationErrorCode =
  | 'REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_EMAIL'
  | 'INVALID_ENUM'
  | 'INVALID_UUID'
  | 'INVALID_FORMAT'
  | 'INVALID_VALUE'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'TOO_SMALL'
  | 'TOO_LARGE'
  | 'UNKNOWN_FIELD'
  | 'FILE_REQUIRED'
  | 'VALIDATION_ERROR';

export interface ErrorDetail {
  field: string;
  code: ValidationErrorCode;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  requestId: string;
  errors?: ErrorDetail[];
}
