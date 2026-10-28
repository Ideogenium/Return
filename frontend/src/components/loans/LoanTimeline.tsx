import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { STATUS_COLORS } from '../../config/theme.config';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../../utils/date';
import type { Loan, Reminder, ReminderType } from '../../types/api.types';

interface TimelineStep {
  label: string;
  date?: string | null;
  reached: boolean;
  variant?: 'default' | 'danger' | 'muted';
}

interface LoanTimelineProps {
  loan: Loan;
  // Fourni uniquement au prêteur ; absent côté emprunteur
  reminders?: Reminder[];
}

const REMINDER_LABEL_KEYS: Record<ReminderType, string> = {
  PREVENTIVE: 'loans.reminderPreventive',
  ON_DUE_DATE: 'loans.reminderOnDueDate',
  FIRST_OVERDUE: 'loans.reminderFirstOverdue',
  SECOND_OVERDUE: 'loans.reminderSecondOverdue',
  FINAL_OVERDUE: 'loans.reminderFinalOverdue',
};

// Rappels émis jusqu'à l'échéance ; les autres (J+7, J+14, J+21) suivent l'étape « retour attendu »
const PRE_DUE_REMINDER_TYPES: ReminderType[] = ['PREVENTIVE', 'ON_DUE_DATE'];

const REMINDER_LOAN_STATUSES: Loan['status'][] = ['ACTIVE', 'ACTIVE_BY_DEFAULT', 'AWAITING_RETURN'];

function toReminderStep(reminder: Reminder, t: (key: string) => string): TimelineStep | null {
  const label = t(REMINDER_LABEL_KEYS[reminder.type]);
  if (reminder.status === 'SENT') return { label, date: reminder.sentAt, reached: true };
  if (reminder.status === 'SCHEDULED') {
    return { label, date: reminder.scheduledFor, reached: false };
  }
  // CANCELLED / FAILED : pas d'étape affichée
  return null;
}

function getReminderSteps(
  reminders: Reminder[],
  t: (key: string) => string,
): { beforeDue: TimelineStep[]; afterDue: TimelineStep[] } {
  const sorted = [...reminders].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const collect = (preDue: boolean) =>
    sorted
      .filter((r) => PRE_DUE_REMINDER_TYPES.includes(r.type) === preDue)
      .map((r) => toReminderStep(r, t))
      .filter((step): step is TimelineStep => step !== null);
  return { beforeDue: collect(true), afterDue: collect(false) };
}

function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  language: string,
): string | null {
  if (!from) return null;
  const f = formatDate(from, language);
  if (!f) return null;
  if (!to) return f;
  const toFormatted = formatDate(to, language);
  if (!toFormatted) return f;
  return f === toFormatted ? f : `${f} — ${toFormatted}`;
}

export function getTimelineSteps(
  loan: Loan,
  t: (key: string) => string,
  language: string,
  reminders: Reminder[] = [],
): TimelineStep[] {
  const steps = getBaseTimelineSteps(loan, t, language);
  if (!REMINDER_LOAN_STATUSES.includes(loan.status) || reminders.length === 0) return steps;

  const { beforeDue, afterDue } = getReminderSteps(reminders, t);
  const awaitingLabel = t('loans.statusAwaitingReturn');
  const awaitingIndex = steps.findIndex((step) => step.label === awaitingLabel);
  if (awaitingIndex === -1) return steps;

  return [
    ...steps.slice(0, awaitingIndex),
    ...beforeDue,
    steps[awaitingIndex]!,
    ...afterDue,
    ...steps.slice(awaitingIndex + 1),
  ];
}

function getBaseTimelineSteps(
  loan: Loan,
  t: (key: string) => string,
  language: string,
): TimelineStep[] {
  const activeLabel =
    loan.status === 'ACTIVE_BY_DEFAULT'
      ? t('loans.statusActiveByDefault')
      : t('loans.statusActive');

  // Active period: from confirmationDate to either returnDate, returnedDate, or updatedAt
  const activePeriodEnd = loan.returnedDate ?? loan.returnDate ?? loan.updatedAt;
  const activeDate = formatDateRange(loan.confirmationDate, activePeriodEnd, language);

  switch (loan.status) {
    case 'PENDING_CONFIRMATION':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        { label: t('loans.statusActive'), reached: false },
        { label: t('loans.statusAwaitingReturn'), date: loan.returnDate, reached: false },
        { label: t('loans.statusReturned'), reached: false },
      ];

    case 'ACTIVE':
    case 'ACTIVE_BY_DEFAULT':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        // Prêt en cours : pas de date à l'étape active (période non terminée)
        { label: activeLabel, reached: true },
        { label: t('loans.statusAwaitingReturn'), date: loan.returnDate, reached: false },
        { label: t('loans.statusReturned'), reached: false },
      ];

    case 'CONTESTED':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        {
          label: t('loans.statusContested'),
          date: loan.updatedAt,
          reached: true,
          variant: 'danger',
        },
      ];

    case 'AWAITING_RETURN':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        { label: activeLabel, date: activeDate, reached: true },
        { label: t('loans.statusAwaitingReturn'), date: loan.returnDate, reached: true },
        { label: t('loans.statusReturned'), reached: false },
      ];

    case 'RETURNED':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        { label: activeLabel, date: activeDate, reached: true },
        { label: t('loans.statusAwaitingReturn'), date: loan.returnDate, reached: true },
        { label: t('loans.statusReturned'), date: loan.returnedDate, reached: true },
      ];

    case 'ABANDONED':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        { label: activeLabel, date: activeDate, reached: true },
        {
          label: t('loans.statusAbandoned'),
          date: loan.updatedAt,
          reached: true,
          variant: 'muted',
        },
      ];

    case 'NOT_RETURNED':
      return [
        { label: t('loans.statusPendingConfirmation'), date: loan.createdAt, reached: true },
        { label: activeLabel, date: activeDate, reached: true },
        { label: t('loans.statusAwaitingReturn'), date: loan.returnDate, reached: true },
        {
          label: t('loans.statusNotReturned'),
          date: loan.updatedAt,
          reached: true,
          variant: 'danger',
        },
      ];

    default:
      return [];
  }
}

export function LoanTimeline({ loan, reminders }: LoanTimelineProps) {
  const { t, i18n } = useTranslation();

  const steps = getTimelineSteps(loan, t, i18n.language, reminders);

  const getDotStyle = (step: TimelineStep) => {
    if (!step.reached) return styles.dotUnreached;
    if (step.variant === 'danger') return styles.dotDanger;
    if (step.variant === 'muted') return styles.dotMuted;
    return styles.dotReached;
  };

  const getLabelStyle = (step: TimelineStep) => {
    if (!step.reached) return styles.stepLabel;
    if (step.variant === 'danger') return [styles.stepLabel, styles.stepLabelDanger];
    if (step.variant === 'muted') return [styles.stepLabel, styles.stepLabelMuted];
    return [styles.stepLabel, styles.stepLabelActive];
  };

  return (
    <View style={styles.container} testID="loan-timeline">
      <View style={styles.currentStatus}>
        <StatusBadge status={loan.status} />
      </View>

      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <View key={`${step.label}-${index}`} style={styles.step}>
            <View style={styles.lineContainer}>
              <View style={[styles.dot, getDotStyle(step)]} />
              {!isLast && (
                <View
                  style={[styles.line, step.reached ? styles.lineReached : styles.lineUnreached]}
                />
              )}
            </View>
            <View style={styles.stepContent}>
              <Text variant="bodyMedium" style={getLabelStyle(step)}>
                {step.label}
              </Text>
              {step.date && (
                <Text variant="bodySmall" style={styles.stepDate}>
                  {formatDate(step.date, i18n.language)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  currentStatus: { marginBottom: 16 },
  step: { flexDirection: 'row', minHeight: 48 },
  lineContainer: { alignItems: 'center', width: 24 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  dotReached: { backgroundColor: STATUS_COLORS.ACTIVE.light },
  dotUnreached: { backgroundColor: '#C9C4BB' },
  dotDanger: { backgroundColor: STATUS_COLORS.NOT_RETURNED.light },
  dotMuted: { backgroundColor: STATUS_COLORS.ABANDONED.light },
  line: { width: 2, flex: 1, marginVertical: 4 },
  lineReached: { backgroundColor: STATUS_COLORS.ACTIVE.light },
  lineUnreached: { backgroundColor: '#EDE9E2' },
  stepContent: { flex: 1, marginLeft: 12, paddingBottom: 12 },
  stepLabel: { color: '#A8B5BF' },
  stepLabelActive: { color: '#2D3748', fontWeight: '600' },
  stepLabelDanger: { color: STATUS_COLORS.NOT_RETURNED.light, fontWeight: '600' },
  stepLabelMuted: { color: STATUS_COLORS.ABANDONED.light, fontWeight: '600' },
  stepDate: { color: '#6B7A8D', marginTop: 2 },
});
