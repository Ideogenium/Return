import { create } from 'zustand';
import apiClient from '../api/apiClient';
import { extractProblemDetails } from '../utils/error';
import type {
  HistoryLoanStatus,
  HistoryLoansParams,
  HistoryStatistics,
  Loan,
  PaginatedResponse,
  PaginationMetadata,
  ProblemDetails,
} from '../types/api.types';

interface HistoryState {
  statistics: HistoryStatistics | null;
  isLoading: boolean;
  error: ProblemDetails | null;

  // Archived loans (GET /history/loans) — separate loading/error flags so the
  // profile statistics and the history screen do not interfere with each other.
  loans: Loan[];
  pagination: PaginationMetadata | null;
  statusFilter: HistoryLoanStatus | null;
  isLoadingLoans: boolean;
  isLoadingMore: boolean;
  loansError: ProblemDetails | null;

  fetchStatistics: () => Promise<void>;
  fetchArchivedLoans: () => Promise<void>;
  fetchNextArchivedLoans: () => Promise<void>;
  setStatusFilter: (status: HistoryLoanStatus | null) => Promise<void>;
  removeArchivedLoan: (id: string) => void;
  reset: () => void;
}

const initialState = {
  statistics: null as HistoryStatistics | null,
  isLoading: false,
  error: null as ProblemDetails | null,
  loans: [] as Loan[],
  pagination: null as PaginationMetadata | null,
  statusFilter: null as HistoryLoanStatus | null,
  isLoadingLoans: false,
  isLoadingMore: false,
  loansError: null as ProblemDetails | null,
};

// Incremented on every "first page" request and on reset: a response whose
// token is outdated (filter changed, screen reset) must not overwrite the state.
let loansRequestToken = 0;

async function requestArchivedLoans(params: HistoryLoansParams) {
  const { data } = await apiClient.get<PaginatedResponse<Loan>>('/history/loans', { params });
  return data;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  ...initialState,

  fetchStatistics: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<HistoryStatistics>('/history/statistics');
      set({ statistics: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      // Silent fail — stats are non-critical; component falls back to zeros
    }
  },

  fetchArchivedLoans: async () => {
    const token = ++loansRequestToken;
    const { statusFilter } = get();
    set({ isLoadingLoans: true, isLoadingMore: false, loansError: null });
    try {
      const data = await requestArchivedLoans({
        page: 1,
        ...(statusFilter && { status: statusFilter }),
      });
      if (token !== loansRequestToken) return;
      set({ loans: data.data, pagination: data.pagination, isLoadingLoans: false });
    } catch (err) {
      if (token !== loansRequestToken) return;
      // The screen renders the error state — no throw
      set({
        loans: [],
        pagination: null,
        isLoadingLoans: false,
        loansError: extractProblemDetails(err),
      });
    }
  },

  fetchNextArchivedLoans: async () => {
    const { pagination, statusFilter, isLoadingLoans, isLoadingMore } = get();
    if (!pagination?.hasNextPage || isLoadingLoans || isLoadingMore) return;

    const token = loansRequestToken;
    set({ isLoadingMore: true, loansError: null });
    try {
      const data = await requestArchivedLoans({
        page: pagination.currentPage + 1,
        ...(statusFilter && { status: statusFilter }),
      });
      if (token !== loansRequestToken) return;
      set((state) => {
        const knownIds = new Set(state.loans.map((loan) => loan.id));
        const newLoans = data.data.filter((loan) => !knownIds.has(loan.id));
        return {
          loans: [...state.loans, ...newLoans],
          pagination: data.pagination,
          isLoadingMore: false,
        };
      });
    } catch (err) {
      if (token !== loansRequestToken) return;
      // Already-loaded loans stay visible; the screen offers a retry in the footer
      set({ isLoadingMore: false, loansError: extractProblemDetails(err) });
    }
  },

  setStatusFilter: async (status) => {
    set({ statusFilter: status });
    await get().fetchArchivedLoans();
  },

  // Keeps the loaded list (and its scroll position) in sync after a deletion
  // without reloading it.
  removeArchivedLoan: (id) =>
    set((state) => {
      if (!state.loans.some((loan) => loan.id === id)) return state;
      return {
        loans: state.loans.filter((loan) => loan.id !== id),
        pagination: state.pagination && {
          ...state.pagination,
          totalItems: Math.max(0, state.pagination.totalItems - 1),
        },
      };
    }),

  reset: () => {
    loansRequestToken++;
    set({ ...initialState });
  },
}));
