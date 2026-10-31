import { create } from 'zustand';
import apiClient from '../api/apiClient';
import type { Reminder } from '../types/api.types';

interface ReminderState {
  loanId: string | null;
  reminders: Reminder[];

  // Never rejects: reminders only complement the display (silent degradation)
  fetchLoanReminders: (loanId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  loanId: null,
  reminders: [],
};

export const useReminderStore = create<ReminderState>((set) => ({
  ...initialState,

  fetchLoanReminders: async (loanId) => {
    // Clear only when the loan changes (never show another loan's reminders); on a refresh of the
    // same loan keep the current list until the response to avoid a flicker.
    set((state) => (state.loanId === loanId ? state : { loanId, reminders: [] }));
    try {
      const { data } = await apiClient.get<Reminder[]>(`/loans/${loanId}/reminders`);
      set((state) => (state.loanId === loanId ? { reminders: data } : state));
    } catch {
      set((state) => (state.loanId === loanId ? { reminders: [] } : state));
    }
  },

  reset: () => set({ ...initialState }),
}));
