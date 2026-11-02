import type { CalendarDay } from '@giba-quadra/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCourtDate, shiftMonth } from '../calendar/dates';
import { colors } from '../theme';

export function MonthCalendar({
  month,
  today,
  days,
  selectedDate,
  loading,
  onMonthChange,
  onSelectDate,
}: {
  month: string;
  today: string;
  days: CalendarDay[];
  selectedDate: string;
  loading: boolean;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells = [...Array.from({ length: offset }, () => null), ...days];
  const previous = shiftMonth(month, -1);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          disabled={loading || previous < today.slice(0, 7)}
          onPress={() => onMonthChange(previous)}
          style={({ pressed }) => [
            styles.arrow,
            (loading || previous < today.slice(0, 7)) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.month}>
          {formatCourtDate(`${month}-01`, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          disabled={loading || shiftMonth(month, 1) === month}
          onPress={() => onMonthChange(shiftMonth(month, 1))}
          style={({ pressed }) => [
            styles.arrow,
            loading && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, index) => (
          <View key={`weekday-${index}`} style={styles.weekday}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.cell} />;
          const selected = selectedDate === day.date;
          const past = day.status === 'past';
          const available = day.status === 'available';
          const label = {
            available: 'com horários livres',
            full: 'sem horários livres',
            closed: 'quadra fechada',
            past: 'dia passado',
          }[day.status];
          return (
            <View key={day.date} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${formatCourtDate(day.date, { day: 'numeric', month: 'long' })}, ${label}`}
                accessibilityState={{ selected, disabled: past || loading }}
                disabled={past || loading}
                onPress={() => onSelectDate(day.date)}
                style={({ pressed }) => [
                  styles.day,
                  selected && styles.selected,
                  past && styles.disabled,
                  day.date === today && !selected && styles.today,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && styles.selectedText,
                    !available && !selected && styles.muted,
                  ]}
                >
                  {Number(day.date.slice(-2))}
                </Text>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: selected
                        ? colors.lime
                        : available
                          ? colors.green
                          : day.status === 'full'
                            ? colors.muted
                            : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>● Livre</Text>
        <Text style={styles.legendMuted}>● Sem vagas</Text>
        <Text style={styles.legendMuted}>Fechado / passado</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  month: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
    flexShrink: 1,
    textAlign: 'center',
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { color: colors.green, fontSize: 32, lineHeight: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', alignItems: 'center', paddingBottom: 10 },
  weekdayText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cell: { width: '14.285714%', padding: 2, minHeight: 48 },
  day: {
    minHeight: 44,
    paddingVertical: 7,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  selected: { backgroundColor: colors.green },
  selectedText: { color: colors.surface },
  today: { borderColor: colors.green },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  muted: { color: colors.muted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendText: { color: colors.green, fontSize: 11 },
  legendMuted: { color: colors.muted, fontSize: 11 },
});
