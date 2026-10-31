import { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { TextInput, ActivityIndicator, Text, Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { UserSearchResultItem } from '../../components/borrowers/UserSearchResultItem';
import { useContactInvitationStore } from '../../stores/useContactInvitationStore';

export function SearchBorrowerScreen() {
  const { t } = useTranslation();
  const { searchResults, isSearching, searchUsers, sendInvitation, cancelInvitation } =
    useContactInvitationStore();

  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.length >= 2) {
        debounceRef.current = setTimeout(() => {
          searchUsers(text).catch(() => {});
        }, 300);
      }
    },
    [searchUsers],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInvite = useCallback(
    (email: string) => {
      sendInvitation(email).catch(() => {});
    },
    [sendInvitation],
  );

  const handleCancel = useCallback(
    (id: string) => {
      cancelInvitation(id).catch(() => {});
    },
    [cancelInvitation],
  );

  const renderEmpty = () => {
    if (isSearching) return null;
    if (query.length < 2) {
      return (
        <View style={styles.emptyState} testID="search-min-length">
          <Icon source="magnify" size={48} color="#C9C4BB" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('invitations.searchMinLength')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState} testID="search-no-results">
        <Icon source="account-search-outline" size={48} color="#C9C4BB" />
        <Text variant="bodyMedium" style={styles.emptyText}>
          {t('invitations.noResults')}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="search-borrower-screen">
      <TextInput
        placeholder={t('invitations.searchPlaceholder')}
        value={query}
        onChangeText={handleQueryChange}
        left={<TextInput.Icon icon="magnify" />}
        style={styles.input}
        testID="search-input"
        autoFocus
      />

      {isSearching && (
        <ActivityIndicator
          style={styles.loader}
          size="small"
          color="#6B8E7B"
          testID="search-loading"
        />
      )}

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={query.length >= 2 ? searchResults : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserSearchResultItem result={item} onInvite={handleInvite} onCancel={handleCancel} />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          searchResults.length === 0 && query.length >= 2 ? styles.emptyContainer : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  input: { margin: 16, backgroundColor: '#FFFFFF' },
  loader: { marginVertical: 8 },
  emptyContainer: { flexGrow: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 48,
  },
  emptyText: { color: '#6B7A8D', marginTop: 12, textAlign: 'center' },
});
