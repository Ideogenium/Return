import { StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-paper-dates';
import { getMinReturnDate } from '../../utils/date';

/**
 * The library's Calendar fills its parent (flex: 1) and draws the days only once it has
 * measured a non-zero height: inside a ScrollView it gets none and shows the week-day
 * names alone. Its month layout (v0.23) needs 4 + 56 + 64 px of header and up to
 * 6 weeks of 52 px.
 */
export const RETURN_DATE_CALENDAR_HEIGHT = 436;

interface ReturnDateCalendarProps {
  date: Date | undefined;
  locale: string;
  onChange: (date: Date | undefined) => void;
  testID?: string;
}

/** Inline calendar for a loan's return date, from the minimum allowed day (J+2) onwards. */
export function ReturnDateCalendar({ date, locale, onChange, testID }: ReturnDateCalendarProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Calendar
        locale={locale}
        mode="single"
        date={date}
        onChange={({ date: picked }) => onChange(picked)}
        validRange={{ startDate: getMinReturnDate() }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: RETURN_DATE_CALENDAR_HEIGHT },
});
