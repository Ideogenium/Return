import { useBorrowerStore } from './useBorrowerStore';
import { useContactInvitationStore } from './useContactInvitationStore';
import { useHistoryStore } from './useHistoryStore';
import { useItemStore } from './useItemStore';
import { useLoanStore } from './useLoanStore';
import { useNotificationStore } from './useNotificationStore';
import { useReminderStore } from './useReminderStore';

// Lives in its own module so useAuthStore can import it without a cycle (it must never import
// useAuthStore). Every store holding the signed-in user's data must be listed here: otherwise the
// next account on the same device would see the previous one's loans, contacts or notifications.
export function resetSessionStores(): void {
  useLoanStore.getState().reset();
  useHistoryStore.getState().reset();
  useReminderStore.getState().reset();
  useBorrowerStore.getState().reset();
  useItemStore.getState().reset();
  useContactInvitationStore.getState().reset();
  useNotificationStore.getState().reset();
}
