import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Portal, TextInput, HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/date';
import { FormDialog } from '../common/FormDialog';
import type { Loan } from '../../types/api.types';

interface ConfirmationDialogProps {
  loan: Loan;
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  /**
   * Called with the typed reason. The dialog keeps the reason and the contest form
   * after the call, so a failure loses nothing: on success, the caller must close
   * the dialog (or leave the screen), which is when the draft is discarded.
   */
  onContest: (reason: string) => void;
  isLoading: boolean;
  /** Message of a failed load, confirm or contest, shown inside the dialog. */
  error?: string;
}

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

export function ConfirmationDialog({
  loan,
  visible,
  onDismiss,
  onConfirm,
  onContest,
  isLoading,
  error,
}: ConfirmationDialogProps) {
  const { t, i18n } = useTranslation();
  const [showContestForm, setShowContestForm] = useState(false);
  const [reason, setReason] = useState('');

  const isReasonValid = reason.length >= MIN_REASON_LENGTH && reason.length <= MAX_REASON_LENGTH;

  const handleContest = () => {
    if (isReasonValid) {
      onContest(reason);
    }
  };

  const handleDismiss = () => {
    setShowContestForm(false);
    setReason('');
    onDismiss();
  };

  return (
    <Portal>
      <FormDialog
        visible={visible}
        onDismiss={handleDismiss}
        title={t('loans.confirmLoan')}
        hasUnsavedInput={showContestForm && reason.length > 0}
        testID="confirmation-dialog"
        scrollTestID="confirmation-dialog-scroll"
        actions={
          showContestForm ? (
            <>
              <Button
                onPress={() => setShowContestForm(false)}
                disabled={isLoading}
                testID="cancel-contest-btn"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onPress={handleContest}
                disabled={!isReasonValid || isLoading}
                loading={isLoading}
                textColor="#D97A6B"
                testID="submit-contest-btn"
              >
                {t('loans.contestLoan')}
              </Button>
            </>
          ) : (
            <>
              <Button
                onPress={() => setShowContestForm(true)}
                textColor="#D97A6B"
                testID="contest-btn"
              >
                {t('loans.contestLoan')}
              </Button>
              <Button
                onPress={onConfirm}
                loading={isLoading}
                disabled={isLoading}
                testID="confirm-btn"
              >
                {t('loans.confirmLoan')}
              </Button>
            </>
          )
        }
      >
        <View style={styles.info}>
          <Text variant="bodyMedium" style={styles.label}>
            {loan.item.name}
          </Text>
          <Text variant="bodySmall" style={styles.sub}>
            {t('navigation.contacts')}: {loan.lender.firstName} {loan.lender.lastName}
          </Text>
          {loan.returnDate && (
            <Text variant="bodySmall" style={styles.sub}>
              {t('loans.returnDate')}: {formatDate(loan.returnDate, i18n.language)}
            </Text>
          )}
        </View>

        {showContestForm && (
          <View style={styles.contestForm}>
            <TextInput
              label={t('loans.contestReason')}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              maxLength={MAX_REASON_LENGTH}
              testID="contest-reason-input"
              contentStyle={{ textAlignVertical: 'top' }}
            />
            <HelperText type={reason.length > 0 && !isReasonValid ? 'error' : 'info'}>
              {reason.length}/{MAX_REASON_LENGTH} (min {MIN_REASON_LENGTH})
            </HelperText>
          </View>
        )}
        {error && (
          <HelperText type="error" testID="confirmation-dialog-error">
            {error}
          </HelperText>
        )}
      </FormDialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  info: { marginBottom: 12 },
  label: { color: '#2D3748', fontWeight: '600' },
  sub: { color: '#6B7A8D', marginTop: 4 },
  contestForm: { marginTop: 12 },
});
