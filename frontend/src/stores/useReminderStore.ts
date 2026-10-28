import { create } from 'zustand';
import apiClient from '../api/apiClient';
import type { Reminder } from '../types/api.types';

interface ReminderState {
  loanId: string | null;
  reminders: Reminder[];

  // Ne rejette jamais : les rappels sont un complément d'affichage (dégradation silencieuse)
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
    // Vide immédiatement pour ne jamais afficher les rappels d'un autre prêt
    set({ loanId, reminders: [] });
    try {
      const { data } = await apiClient.get<Reminder[]>(`/loans/${loanId}/reminders`);
      set((state) => (state.loanId === loanId ? { reminders: data } : state));
    } catch {
      set((state) => (state.loanId === loanId ? { reminders: [] } : state));
    }
  },

  reset: () => set({ ...initialState }),
}));
