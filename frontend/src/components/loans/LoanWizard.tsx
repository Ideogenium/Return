import { useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import {
  Text,
  Button,
  TextInput,
  RadioButton,
  HelperText,
  Icon,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import i18n from '../../config/i18n.config';
import { ui } from '../../config/theme.config';
import { useItemStore } from '../../stores/useItemStore';
import { useBorrowerStore } from '../../stores/useBorrowerStore';
import { ItemForm } from '../items/ItemForm';
import { formatDate, toLocalIsoDate } from '../../utils/date';
import { ReturnDateCalendar } from './ReturnDateCalendar';
import type { CreateLoanDto, CreateItemDto } from '../../types/api.types';
import { FormScrollView } from '../common/FormScrollView';

type LoanType = 'OBJECT' | 'MONEY';

interface LoanWizardProps {
  onSubmit: (data: CreateLoanDto) => void;
  isLoading: boolean;
  error?: string;
}

export function LoanWizard({ onSubmit, isLoading, error }: LoanWizardProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { items } = useItemStore();
  const { borrowers } = useBorrowerStore();

  const [step, setStep] = useState(1);
  const [loanType, setLoanType] = useState<LoanType>('OBJECT');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState('');
  const [returnDateObj, setReturnDateObj] = useState<Date | undefined>();
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [notes, setNotes] = useState('');

  const [showItemDialog, setShowItemDialog] = useState(false);
  const [itemDialogLoading, setItemDialogLoading] = useState(false);
  const [itemDialogError, setItemDialogError] = useState<string | undefined>();
  const STEP_TITLES = [
    t('loans.wizardStep1'),
    t('loans.wizardStep2'),
    t('loans.wizardStep3'),
    t('loans.wizardStep4'),
  ];

  const isValidAmount = (value: string): boolean => {
    const parsed = parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0;
  };

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return loanType === 'OBJECT' ? selectedItemId !== null : isValidAmount(amount);
      case 3:
        return selectedBorrowerId !== null;
      default:
        return true;
    }
  };

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    const itemValue =
      loanType === 'OBJECT'
        ? selectedItemId!
        : {
            name: `${t('loans.moneyLoan')} — ${amount} €`,
            category: 'MONEY' as const,
            estimatedValue: Number.isFinite(parsedAmount) ? parsedAmount : 0,
          };

    onSubmit({
      item: itemValue,
      borrowerId: selectedBorrowerId!,
      returnDate,
      notes: notes || null,
    });
  };

  const handleInlineItemCreate = async (data: CreateItemDto) => {
    setItemDialogLoading(true);
    setItemDialogError(undefined);
    try {
      const newItem = await useItemStore.getState().createItem(data);
      setSelectedItemId(newItem.id);
      setShowItemDialog(false);
    } catch {
      setItemDialogError(t('errors.unknownError'));
    } finally {
      setItemDialogLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent} testID="wizard-step-1">
      <Text variant="titleMedium" style={styles.stepTitle}>
        {STEP_TITLES[0]}
      </Text>

      <RadioButton.Group onValueChange={(v) => setLoanType(v as LoanType)} value={loanType}>
        <Pressable onPress={() => setLoanType('OBJECT')} testID="type-object-card">
          <View
            style={[styles.typeCard, ui.card, loanType === 'OBJECT' && styles.typeCardSelected]}
          >
            <RadioButton.Android value="OBJECT" color="#6B8E7B" testID="type-object" />
            <Icon source="package-variant-closed" size={24} color="#4A6355" />
            <Text variant="bodyLarge" style={styles.typeLabel}>
              {t('loans.objectLoan')}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setLoanType('MONEY')} testID="type-money-card">
          <View style={[styles.typeCard, ui.card, loanType === 'MONEY' && styles.typeCardSelected]}>
            <RadioButton.Android value="MONEY" color="#6B8E7B" testID="type-money" />
            <Icon source="cash-multiple" size={24} color="#4A6355" />
            <Text variant="bodyLarge" style={styles.typeLabel}>
              {t('loans.moneyLoan')}
            </Text>
          </View>
        </Pressable>
      </RadioButton.Group>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent} testID="wizard-step-2">
      <Text variant="titleMedium" style={styles.stepTitle}>
        {STEP_TITLES[1]}
      </Text>

      {loanType === 'OBJECT' ? (
        <>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={items.filter((i) => i.category !== 'MONEY')}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedItemId(item.id)}
                testID={`select-item-${item.id}`}
              >
                <View
                  style={[
                    styles.listItem,
                    ui.card,
                    selectedItemId === item.id && styles.listItemSelected,
                  ]}
                >
                  <RadioButton.Android
                    value={item.id}
                    status={selectedItemId === item.id ? 'checked' : 'unchecked'}
                    onPress={() => setSelectedItemId(item.id)}
                    color="#6B8E7B"
                  />
                  <Text variant="bodyMedium" style={styles.listItemText}>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('items.emptyList')}
              </Text>
            }
            style={styles.list}
          />
          <Button
            mode="outlined"
            icon="plus"
            onPress={() => setShowItemDialog(true)}
            style={styles.inlineCreateBtn}
            testID="inline-create-item-btn"
          >
            {t('items.addItem')}
          </Button>
        </>
      ) : (
        <TextInput
          label={t('loans.selectAmount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          right={<TextInput.Affix text="€" />}
          style={[styles.input, ui.input]}
          testID="amount-input"
        />
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent} testID="wizard-step-3">
      <Text variant="titleMedium" style={styles.stepTitle}>
        {STEP_TITLES[2]}
      </Text>

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={borrowers}
        keyExtractor={(b) => b.id}
        renderItem={({ item: b }) => (
          <Pressable onPress={() => setSelectedBorrowerId(b.id)} testID={`select-borrower-${b.id}`}>
            <View
              style={[
                styles.listItem,
                ui.card,
                selectedBorrowerId === b.id && styles.listItemSelected,
              ]}
            >
              <RadioButton.Android
                value={b.id}
                status={selectedBorrowerId === b.id ? 'checked' : 'unchecked'}
                onPress={() => setSelectedBorrowerId(b.id)}
                color="#6B8E7B"
              />
              <Text variant="bodyMedium" style={styles.listItemText}>
                {b.firstName} {b.lastName}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBorrowerState} testID="no-borrowers-empty">
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('invitations.noBorrowers')}
            </Text>
            <Button
              mode="outlined"
              icon="account-search"
              onPress={() => {
                // Cross-stack navigation requires type bypass
                (navigation as { navigate: (screen: string, params?: object) => void }).navigate(
                  'BorrowerTab',
                  { screen: 'SearchBorrower' },
                );
              }}
              style={styles.inlineCreateBtn}
              testID="search-contact-btn"
            >
              {t('invitations.invite')}
            </Button>
          </View>
        }
        style={styles.list}
      />
    </View>
  );

  const renderStep4 = () => {
    const selectedItem = items.find((i) => i.id === selectedItemId);
    const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId);

    return (
      <View style={styles.stepContent} testID="wizard-step-4">
        <Text variant="titleMedium" style={styles.stepTitle}>
          {STEP_TITLES[3]}
        </Text>

        <View style={[styles.summary, ui.card]}>
          <View style={styles.summaryRow}>
            <Text variant="labelMedium" style={styles.summaryLabel}>
              {t('loans.type')}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryValue}>
              {loanType === 'OBJECT' ? t('loans.objectLoan') : t('loans.moneyLoan')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="labelMedium" style={styles.summaryLabel}>
              {loanType === 'OBJECT' ? t('items.title') : t('loans.selectAmount')}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryValue}>
              {loanType === 'OBJECT' ? (selectedItem?.name ?? '-') : `${amount} €`}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="labelMedium" style={styles.summaryLabel}>
              {t('navigation.contacts')}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryValue}>
              {selectedBorrower
                ? `${selectedBorrower.firstName} ${selectedBorrower.lastName}`
                : '-'}
            </Text>
          </View>
        </View>

        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setCalendarExpanded((v) => !v)}
          style={styles.input}
          testID="return-date-input"
        >
          {returnDateObj ? formatDate(returnDateObj, i18n.language) : t('loans.returnDate')}
        </Button>
        {!returnDate && (
          <HelperText type="error" testID="return-date-required">
            {t('loans.returnDateRequired')}
          </HelperText>
        )}
        {calendarExpanded && (
          <ReturnDateCalendar
            locale={i18n.language}
            date={returnDateObj}
            onChange={(date) => {
              if (date) {
                setReturnDateObj(date);
                setReturnDate(toLocalIsoDate(date));
              }
              setCalendarExpanded(false);
            }}
            testID="return-date-calendar"
          />
        )}
        {calendarExpanded && <HelperText type="info">{t('loans.returnDateTooSoon')}</HelperText>}

        <TextInput
          label={t('loans.notes')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder={t('loans.notesPlaceholder')}
          style={[styles.input, ui.input]}
          testID="notes-input"
        />

        {error && (
          <HelperText type="error" testID="wizard-error">
            {error}
          </HelperText>
        )}
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} testID="loan-wizard">
      <View style={styles.progress}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[styles.progressDot, s <= step && styles.progressDotActive]}
            testID={`progress-dot-${s}`}
          />
        ))}
      </View>

      {renderCurrentStep()}

      <View style={styles.buttons}>
        {step > 1 && (
          <Button
            mode="outlined"
            onPress={() => setStep((s) => s - 1)}
            style={styles.backButton}
            testID="wizard-back-btn"
          >
            {t('common.back')}
          </Button>
        )}
        {step < 4 ? (
          <Button
            mode="contained"
            onPress={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            style={styles.nextButton}
            testID="wizard-next-btn"
          >
            {t('common.confirm')}
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !returnDate}
            style={styles.nextButton}
            testID="wizard-submit-btn"
          >
            {t('loans.addLoan')}
          </Button>
        )}
      </View>

      <Portal>
        <Dialog
          visible={showItemDialog}
          onDismiss={() => setShowItemDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{t('items.addItem')}</Dialog.Title>
          <Dialog.ScrollArea>
            <FormScrollView>
              <ItemForm
                mode="create"
                onSubmit={handleInlineItemCreate}
                isLoading={itemDialogLoading}
                error={itemDialogError}
                submitLabel={t('common.save')}
              />
            </FormScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EDE9E2' },
  progressDotActive: { backgroundColor: '#6B8E7B' },
  stepContent: { flex: 1 },
  stepTitle: { color: '#2D3748', fontWeight: '700', marginBottom: 16 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  typeCardSelected: { borderColor: '#6B8E7B', borderWidth: 2 },
  typeLabel: { color: '#2D3748', fontWeight: '600' },
  list: { maxHeight: 300 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 6,
  },
  listItemSelected: { borderColor: '#6B8E7B', borderWidth: 2 },
  listItemText: { color: '#2D3748', flex: 1 },
  emptyText: { color: '#6B7A8D', textAlign: 'center', padding: 32 },
  emptyBorrowerState: { alignItems: 'center', paddingVertical: 16 },
  input: { marginBottom: 12 },
  summary: { padding: 16, marginBottom: 16 },
  summaryRow: { marginBottom: 10 },
  summaryLabel: { color: '#A8B5BF', marginBottom: 2 },
  summaryValue: { color: '#2D3748' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, gap: 12 },
  backButton: { flex: 1, borderRadius: 12, borderColor: '#C9C4BB' },
  nextButton: { flex: 1, borderRadius: 12 },
  inlineCreateBtn: { marginTop: 8, borderRadius: 12, borderColor: '#C9C4BB' },
  dialog: { maxHeight: '80%' },
});
