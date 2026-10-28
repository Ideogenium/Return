import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ItemForm } from '../../components/items/ItemForm';
import { useItemStore } from '../../stores/useItemStore';
import { RefreshError } from '../../components/common/RefreshError';
import { useEntityLoad } from '../../hooks/useEntityLoad';
import { parseProblemDetails, getErrorMessage } from '../../utils/error';
import type { ItemStackParamList } from '../../navigation/types';
import type { UpdateItemDto } from '../../types/api.types';
import type { AxiosError } from 'axios';

type Props = NativeStackScreenProps<ItemStackParamList, 'EditItem'>;

export function EditItemScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { selectedItem, fetchItem } = useItemStore();
  const { loadError, reload } = useEntityLoad(id, fetchItem);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  // Full-screen states only while nothing is displayable for this id: saving keeps the
  // form mounted, with what the user typed.
  if (!selectedItem || selectedItem.id !== id) {
    if (!loadError) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6B8E7B" testID="loading" />
        </View>
      );
    }
    return (
      <View style={styles.centerContainer} testID="item-error">
        <Text variant="titleMedium" style={styles.errorText}>
          {loadError.type?.includes('item-not-found')
            ? t('errors.itemNotFound')
            : t('errors.unknownError')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
          {t('common.back')}
        </Button>
      </View>
    );
  }

  const handleSubmit = async (data: UpdateItemDto) => {
    setIsLoading(true);
    setApiError(undefined);
    try {
      await useItemStore.getState().updateItem(id, data);
      navigation.goBack();
    } catch (err) {
      const problem = parseProblemDetails(err as AxiosError);
      setApiError(problem ? getErrorMessage(problem, t) : t('errors.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="edit-item">
      {loadError && <RefreshError problem={loadError} onRetry={reload} />}
      <ItemForm
        mode="edit"
        defaultValues={{
          name: selectedItem.name,
          category: selectedItem.category,
          description: selectedItem.description ?? '',
          estimatedValue: selectedItem.estimatedValue ?? undefined,
        }}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={apiError}
        submitLabel={t('common.save')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#6B7A8D', textAlign: 'center', marginBottom: 16 },
  backButton: { borderRadius: 12 },
});
