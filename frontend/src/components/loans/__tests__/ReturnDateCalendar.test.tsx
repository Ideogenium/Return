import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { ReturnDateCalendar, RETURN_DATE_CALENDAR_HEIGHT } from '../ReturnDateCalendar';

const mockCalendarProps = jest.fn();

// The real Calendar only lays out in a native runtime: capture its props and expose a select button.
jest.mock('react-native-paper-dates', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    Calendar: (props: { onChange: (params: { date: Date | undefined }) => void }) => {
      mockCalendarProps(props);
      return React.createElement(Pressable, {
        testID: 'mock-calendar-select',
        onPress: () => props.onChange({ date: new Date(2026, 11, 31) }),
      });
    },
  };
});

function renderCalendar(date?: Date, onChange = jest.fn()) {
  render(
    <PaperProvider>
      <ReturnDateCalendar date={date} locale="fr" onChange={onChange} testID="calendar" />
    </PaperProvider>,
  );
  return onChange;
}

describe('ReturnDateCalendar', () => {
  beforeEach(() => mockCalendarProps.mockClear());

  // Regression: inside a ScrollView the library's Calendar (flex: 1) got a height of 0
  // and only drew the week-day names, never the days of the month.
  it('gives the calendar a fixed height, tall enough for a six-week month', () => {
    renderCalendar();

    const style = StyleSheet.flatten(screen.getByTestId('calendar').props.style);
    // Library layout (v0.23): month header 4 + 56 + 64 px, then up to 6 weeks of 46 + 6 px.
    expect(RETURN_DATE_CALENDAR_HEIGHT).toBeGreaterThanOrEqual(4 + 56 + 64 + 6 * (46 + 6));
    expect(style.height).toBe(RETURN_DATE_CALENDAR_HEIGHT);
  });

  it('shows a single-date calendar in the app language, starting at the minimum return date', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 29, 10, 0));
    try {
      const selected = new Date(2026, 10, 15);
      renderCalendar(selected);

      expect(mockCalendarProps).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'single',
          locale: 'fr',
          date: selected,
          validRange: { startDate: new Date(2026, 9, 31) },
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports the picked day', () => {
    const onChange = renderCalendar();

    fireEvent.press(screen.getByTestId('mock-calendar-select'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 11, 31));
  });

  it('reports a cleared selection as undefined', () => {
    const onChange = renderCalendar();
    const { onChange: calendarOnChange } = mockCalendarProps.mock.calls[0][0];

    calendarOnChange({ date: undefined });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
