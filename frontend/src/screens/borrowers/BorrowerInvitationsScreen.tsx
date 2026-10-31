import { useEffect } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ui } from '../../config/theme.config';
import { formatDate } from '../../utils/date';
import { useContactInvitationStore } from '../../stores/useContactInvitationStore';

export function BorrowerInvitationsScreen() {
  const { t, i18n } = useTranslation();
  const {
    receivedInvitations,
    isLoading,
    fetchReceivedInvitations,
    acceptInvitation,
    rejectInvitation,
  } = useContactInvitationStore();

  useEffect(() => {
    fetchReceivedInvitations().catch(() => {});
  }, [fetchReceivedInvitations]);

  if (isLoading && receivedInvitations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="borrower-invitations-screen">
      <FlatList
        data={receivedInvitations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, ui.card]} testID={`invitation-${item.id}`}>
            <View style={styles.info}>
              <Text variant="bodyLarge" style={styles.name}>
                {item.senderUser.firstName} {item.senderUser.lastName}
              </Text>
              <Text variant="bodySmall" style={styles.date}>
                {formatDate(item.createdAt, i18n.language)}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button
                mode="contained"
                compact
                onPress={() => acceptInvitation(item.id).catch(() => {})}
                style={styles.acceptBtn}
                testID={`accept-${item.id}`}
              >
                {t('invitations.accept')}
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => rejectInvitation(item.id).catch(() => {})}
                style={styles.rejectBtn}
                testID={`reject-${item.id}`}
              >
                {t('invitations.reject')}
              </Button>
            </View>
          </View>
        )}
        contentContainerStyle={
          receivedInvitations.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState} testID="invitations-empty">
            <Icon source="email-open-outline" size={64} color="#C9C4BB" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('invitations.emptyReceived')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingTop: 12, paddingBottom: 24 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#6B7A8D', marginTop: 12, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  info: { flex: 1 },
  name: { color: '#2D3748', fontWeight: '600' },
  date: { color: '#A8B5BF', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { borderRadius: 12 },
  rejectBtn: { borderRadius: 12, borderColor: '#C9C4BB' },
});
