import {
  canSelectStart,
  clockTime,
  gameDuration,
  minutes,
  monthDates,
  type AvailabilityResponse,
  type CalendarRole,
  type CourtOccupancy,
  type CourtSchedule,
  type GameModality,
  type TimeRange,
} from '@giba-quadra/contracts';

export function courtClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minute:
      Number(part('hour')) * 60 +
      Number(part('minute')) +
      (Number(part('second')) > 0 || now.getUTCMilliseconds() > 0 ? 1 : 0),
  };
}

function subtract(ranges: TimeRange[], occupied: TimeRange[]): TimeRange[] {
  let result = ranges.map((range) => ({ start: minutes(range.start), end: minutes(range.end) }));
  for (const block of occupied) {
    const start = minutes(block.start);
    const end = minutes(block.end);
    result = result.flatMap((range) => {
      if (end <= range.start || start >= range.end) return [range];
      return [
        ...(start > range.start ? [{ start: range.start, end: start }] : []),
        ...(end < range.end ? [{ start: end, end: range.end }] : []),
      ];
    });
  }
  return result.map((range) => ({ start: clockTime(range.start), end: clockTime(range.end) }));
}

export function buildAvailability({
  month,
  modality,
  schedule,
  occupancies,
  role,
  now,
}: {
  month: string;
  modality: GameModality;
  schedule: CourtSchedule;
  occupancies: CourtOccupancy[];
  role: CalendarRole;
  now: Date;
}): AvailabilityResponse {
  const clock = courtClock(now, schedule.timeZone);
  const duration = gameDuration[modality];
  const days = monthDates(month).map((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const settings =
      schedule.overrides.find((item) => item.date === date) ??
      schedule.weekly.find((item) => item.weekday === weekday)!;
    const occupied = occupancies
      .filter((item) => item.date === date)
      .sort((a, b) => a.start.localeCompare(b.start));
    const windows = [...settings.windows].sort((a, b) => a.start.localeCompare(b.start));
    const freeRanges = subtract(windows, occupied)
      .map((range) => ({
        start:
          date === clock.date
            ? clockTime(Math.max(minutes(range.start), clock.minute))
            : range.start,
        end: range.end,
      }))
      .filter(
        (range) => date >= clock.date && minutes(range.end) - minutes(range.start) >= duration,
      );
    const startTimes = settings.startTimes ? [...settings.startTimes].sort() : null;
    const available = freeRanges.some(
      (range) =>
        startTimes === null ||
        startTimes.some(
          (time) =>
            minutes(time) >= minutes(range.start) && minutes(time) + duration <= minutes(range.end),
        ),
    );
    return {
      date,
      status:
        date < clock.date
          ? ('past' as const)
          : windows.length === 0
            ? ('closed' as const)
            : available
              ? ('available' as const)
              : ('full' as const),
      windows,
      startTimes,
      freeRanges,
      // Montar a resposta explicitamente: nunca enviar IDs, participantes ou nomes ao sócio.
      occupancies: occupied.map((item) => ({
        date,
        start: item.start,
        end: item.end,
        kind: item.kind,
        ...(role !== 'member' && item.responsibleName
          ? { responsibleName: item.responsibleName }
          : {}),
      })),
    };
  });
  return {
    month,
    timeZone: schedule.timeZone,
    today: clock.date,
    modality,
    durationMinutes: duration,
    days,
  };
}

export function withSelection(
  body: AvailabilityResponse,
  date: string,
  start: string,
): AvailabilityResponse {
  const day = body.days.find((item) => item.date === date)!;
  return {
    ...body,
    selection: {
      date,
      start,
      end: clockTime(minutes(start) + body.durationMinutes),
      available: canSelectStart(day, start, body.durationMinutes),
    },
  };
}
