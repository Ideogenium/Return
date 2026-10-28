import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { LoanTimeline, getTimelineSteps } from '../LoanTimeline';
import type { Loan, Reminder, ReminderType, ReminderStatus } from '../../../types/api.types';

const t = (key: string) => key;

function buildLoan(status: Loan['status']): Loan {
  return {
    id: 'loan-1',
    status,
    returnDate: '2026-04-15',
    confirmationDate: '2026-02-02T10:00:00Z',
    returnedDate: null,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-02T10:00:00Z',
  } as unknown as Loan;
}

function buildReminder(
  type: ReminderType,
  status: ReminderStatus,
  scheduledFor: string,
  sentAt: string | null = null,
): Reminder {
  return {
    id: `${type}-${status}`,
    loanId: 'loan-1',
    type,
    status,
    scheduledFor,
    sentAt,
    channel: 'PUSH',
  };
}

describe('getTimelineSteps with reminders', () => {
  it('should mark a SENT reminder as reached with its sentAt date', () => {
    const loan = buildLoan('ACTIVE');
    const reminders = [
      buildReminder('PREVENTIVE', 'SENT', '2026-04-12T08:00:00Z', '2026-04-12T08:01:00Z'),
    ];

    const steps = getTimelineSteps(loan, t, 'en', reminders);

    const step = steps.find((s) => s.label === 'loans.reminderPreventive');
    expect(step).toEqual(expect.objectContaining({ reached: true, date: '2026-04-12T08:01:00Z' }));
  });

  it('should mark a SCHEDULED reminder as not reached with its scheduledFor date', () => {
    const loan = buildLoan('ACTIVE');
    const reminders = [buildReminder('ON_DUE_DATE', 'SCHEDULED', '2026-04-15T08:00:00Z')];

    const steps = getTimelineSteps(loan, t, 'en', reminders);

    const step = steps.find((s) => s.label === 'loans.reminderOnDueDate');
    expect(step).toEqual(expect.objectContaining({ reached: false, date: '2026-04-15T08:00:00Z' }));
  });

  it('should ignore CANCELLED reminders', () => {
    const loan = buildLoan('ACTIVE');
    const reminders = [buildReminder('FIRST_OVERDUE', 'CANCELLED', '2026-04-22T08:00:00Z')];

    const steps = getTimelineSteps(loan, t, 'en', reminders);

    expect(steps).toEqual(getTimelineSteps(loan, t, 'en'));
  });

  it('should return the base steps when there are no reminders', () => {
    const loan = buildLoan('ACTIVE');

    expect(getTimelineSteps(loan, t, 'en', [])).toHaveLength(4);
    expect(getTimelineSteps(loan, t, 'en')).toHaveLength(4);
  });

  it('should place due-date reminders before and overdue reminders after the awaiting-return step', () => {
    const loan = buildLoan('AWAITING_RETURN');
    const reminders = [
      buildReminder('FIRST_OVERDUE', 'SCHEDULED', '2026-04-22T08:00:00Z'),
      buildReminder('ON_DUE_DATE', 'SENT', '2026-04-15T08:00:00Z', '2026-04-15T08:00:05Z'),
    ];

    const labels = getTimelineSteps(loan, t, 'en', reminders).map((s) => s.label);

    expect(labels).toEqual([
      'loans.statusPendingConfirmation',
      'loans.statusActive',
      'loans.reminderOnDueDate',
      'loans.statusAwaitingReturn',
      'loans.reminderFirstOverdue',
      'loans.statusReturned',
    ]);
  });

  it('should add reminder steps for ACTIVE_BY_DEFAULT loans', () => {
    const loan = buildLoan('ACTIVE_BY_DEFAULT');
    const reminders = [buildReminder('PREVENTIVE', 'SCHEDULED', '2026-04-12T08:00:00Z')];

    expect(getTimelineSteps(loan, t, 'en', reminders)).toHaveLength(5);
  });

  it.each(['RETURNED', 'ABANDONED', 'NOT_RETURNED', 'CONTESTED', 'PENDING_CONFIRMATION'] as const)(
    'should not add reminder steps for %s loans',
    (status) => {
      const reminders = [
        buildReminder('PREVENTIVE', 'SENT', '2026-04-12T08:00:00Z', '2026-04-12T08:01:00Z'),
      ];

      expect(getTimelineSteps(buildLoan(status), t, 'en', reminders)).toEqual(
        getTimelineSteps(buildLoan(status), t, 'en'),
      );
    },
  );
});

describe('LoanTimeline rendering', () => {
  it('should render reminder steps when reminders are provided', () => {
    const reminders = [buildReminder('FIRST_OVERDUE', 'SCHEDULED', '2026-04-22T08:00:00Z')];

    render(
      <PaperProvider>
        <LoanTimeline loan={buildLoan('AWAITING_RETURN')} reminders={reminders} />
      </PaperProvider>,
    );

    expect(screen.getByText('Reminder D+7')).toBeTruthy();
  });

  it('should render without reminders', () => {
    render(
      <PaperProvider>
        <LoanTimeline loan={buildLoan('ACTIVE')} />
      </PaperProvider>,
    );

    expect(screen.getByTestId('loan-timeline')).toBeTruthy();
    expect(screen.queryByText(/reminder/i)).toBeNull();
  });
});
