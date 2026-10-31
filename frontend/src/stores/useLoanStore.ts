import { create } from 'zustand';
import apiClient from '../api/apiClient';
import { extractProblemDetails } from '../utils/error';
import type {
  Loan,
  LoanStatus,
  CreateLoanDto,
  UpdateLoanDto,
  UpdateLoanStatusDto,
  ContestLoanDto,
  PaginatedResponse,
  ProblemDetails,
} from '../types/api.types';

interface FetchLoansParams {
  role?: 'lender' | 'borrower';
  page?: number;
  status?: LoanStatus[];
  borrowerId?: string;
  sortBy?: 'createdAt' | 'returnDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface LoanState {
  loans: Loan[];
  selectedLoan: Loan | null;
  isLoading: boolean;
  error: ProblemDetails | null;

  fetchLoans: (params?: FetchLoansParams) => Promise<void>;
  fetchLoan: (id: string) => Promise<void>;
  createLoan: (data: CreateLoanDto) => Promise<Loan>;
  updateLoan: (id: string, data: UpdateLoanDto) => Promise<Loan>;
  deleteLoan: (id: string) => Promise<void>;
  updateStatus: (id: string, data: UpdateLoanStatusDto) => Promise<Loan>;
  confirmLoan: (id: string) => Promise<Loan>;
  contestLoan: (id: string, data: ContestLoanDto) => Promise<Loan>;
  reset: () => void;
}

const initialState = {
  loans: [],
  selectedLoan: null,
  isLoading: false,
  error: null,
};

export const useLoanStore = create<LoanState>((set) => ({
  ...initialState,

  fetchLoans: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<PaginatedResponse<Loan>>('/loans', {
        params: {
          role: params?.role ?? 'lender',
          page: params?.page ?? 1,
          limit: 20,
          ...(params?.status && { status: params.status.join(',') }),
          ...(params?.borrowerId && { borrowerId: params.borrowerId }),
          ...(params?.sortBy !== undefined && { sortBy: params.sortBy }),
          ...(params?.sortOrder !== undefined && { sortOrder: params.sortOrder }),
        },
      });
      set({ loans: data.data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  fetchLoan: async (id) => {
    // Keep the loan on screen while it is refreshed; never show another loan in its place.
    set((state) => ({
      isLoading: true,
      error: null,
      selectedLoan: state.selectedLoan?.id === id ? state.selectedLoan : null,
    }));
    try {
      const { data } = await apiClient.get<Loan>(`/loans/${id}`);
      set({ selectedLoan: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  createLoan: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: newLoan } = await apiClient.post<Loan>('/loans', data);
      set((state) => ({
        loans: [...state.loans, newLoan],
        isLoading: false,
      }));
      return newLoan;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  updateLoan: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: updated } = await apiClient.patch<Loan>(`/loans/${id}`, data);
      set((state) => ({
        loans: state.loans.map((l) => (l.id === id ? updated : l)),
        selectedLoan: state.selectedLoan?.id === id ? updated : state.selectedLoan,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  deleteLoan: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/loans/${id}`);
      set((state) => ({
        loans: state.loans.filter((l) => l.id !== id),
        selectedLoan: state.selectedLoan?.id === id ? null : state.selectedLoan,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  updateStatus: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: updated } = await apiClient.patch<Loan>(`/loans/${id}/status`, data);
      set((state) => ({
        loans: state.loans.map((l) => (l.id === id ? updated : l)),
        selectedLoan: state.selectedLoan?.id === id ? updated : state.selectedLoan,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  confirmLoan: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { data: updated } = await apiClient.post<Loan>(`/loans/${id}/confirm`);
      set((state) => ({
        loans: state.loans.map((l) => (l.id === id ? updated : l)),
        selectedLoan: state.selectedLoan?.id === id ? updated : state.selectedLoan,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  contestLoan: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: updated } = await apiClient.post<Loan>(`/loans/${id}/contest`, data);
      set((state) => ({
        loans: state.loans.map((l) => (l.id === id ? updated : l)),
        selectedLoan: state.selectedLoan?.id === id ? updated : state.selectedLoan,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  reset: () => set({ ...initialState }),
}));
