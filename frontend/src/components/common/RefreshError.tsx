import { StyleSheet, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/error';
import type { ProblemDetails } from '../../types/api.types';

interface RefreshErrorProps {
  problem: ProblemDetails;
  onRetry: () => void;
}

/** Non-blocking error of a failed refresh: the data already displayed stays on screen. */
export function RefreshError({ problem, onRetry }: RefreshErrorProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID="refresh-error">
      <HelperText type="error" style={styles.message}>
        {getErrorMessage(problem, t)}
      </HelperText>
      <Button mode="text" onPress={onRetry} testID="refresh-retry-btn" compact>
        {t('common.retry')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8 },
  message: { flex: 1 },
});
