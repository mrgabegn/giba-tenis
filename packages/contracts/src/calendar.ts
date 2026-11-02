export type GameModality = 'singles' | 'doubles';
export type CalendarRole = 'member' | 'admin' | 'teacher';
export const gameDuration: Record<GameModality, number> = { singles: 90, doubles: 120 };

export type TimeRange = { start: string; end: string };
export type DaySchedule = { windows: TimeRange[]; startTimes?: string[] };
export type CourtSchedule = {
  timeZone: string;
  weekly: (DaySchedule & { weekday: number })[];
  overrides: (DaySchedule & { date: string })[];
};
export type CourtOccupancy = TimeRange & {
  date: string;
  kind: 'lesson' | 'booking' | 'block';
  responsibleName?: string;
};
export type CalendarDay = {
  date: string;
  status: 'available' | 'full' | 'closed' | 'past';
  windows: TimeRange[];
  startTimes: string[] | null;
  freeRanges: TimeRange[];
  occupancies: CourtOccupancy[];
};
export type AvailabilityResponse = {
  month: string;
  timeZone: string;
  today: string;
  modality: GameModality;
  durationMinutes: number;
  days: CalendarDay[];
  selection?: { date: string; start: string; end: string; available: boolean };
};

export function isModality(value: unknown): value is GameModality {
  return value === 'singles' || value === 'doubles';
}

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

export function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function clockTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function monthDates(month: string): string[] {
  if (!isMonth(month)) return [];
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTimeRange(value: unknown): value is TimeRange {
  return (
    record(value) &&
    isClockTime(value.start) &&
    (isClockTime(value.end) || value.end === '24:00') &&
    minutes(value.start) < minutes(value.end)
  );
}

function isDaySchedule(value: unknown): value is DaySchedule {
  if (!record(value) || !Array.isArray(value.windows) || !value.windows.every(isTimeRange)) {
    return false;
  }
  const windows = [...value.windows].sort((a, b) => a.start.localeCompare(b.start));
  if (windows.some((window, index) => index > 0 && window.start < windows[index - 1]!.end)) {
    return false;
  }
  return (
    value.startTimes === undefined ||
    (Array.isArray(value.startTimes) &&
      value.startTimes.every(
        (time) =>
          isClockTime(time) && windows.some((window) => time >= window.start && time < window.end),
      ) &&
      new Set(value.startTimes).size === value.startTimes.length)
  );
}

export function isCourtSchedule(value: unknown): value is CourtSchedule {
  if (
    !record(value) ||
    typeof value.timeZone !== 'string' ||
    !Array.isArray(value.weekly) ||
    value.weekly.length !== 7 ||
    !Array.isArray(value.overrides)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format();
  } catch {
    return false;
  }
  return (
    value.weekly.every(
      (day) =>
        record(day) &&
        Number.isInteger(day.weekday) &&
        Number(day.weekday) >= 0 &&
        Number(day.weekday) <= 6 &&
        isDaySchedule(day),
    ) &&
    new Set(value.weekly.map((day) => day.weekday)).size === 7 &&
    value.overrides.every((day) => record(day) && isCalendarDate(day.date) && isDaySchedule(day)) &&
    new Set(value.overrides.map((day) => day.date)).size === value.overrides.length
  );
}

export function isCourtOccupancy(value: unknown): value is CourtOccupancy {
  return (
    record(value) &&
    isCalendarDate(value.date) &&
    ['lesson', 'booking', 'block'].includes(String(value.kind)) &&
    (value.responsibleName === undefined || typeof value.responsibleName === 'string') &&
    isTimeRange(value)
  );
}

export function canSelectStart(day: CalendarDay, start: string, duration: number): boolean {
  return (
    day.status === 'available' &&
    isClockTime(start) &&
    (day.startTimes === null || day.startTimes.includes(start)) &&
    day.freeRanges.some(
      (range) =>
        minutes(start) >= minutes(range.start) && minutes(start) + duration <= minutes(range.end),
    )
  );
}

export function isAvailabilityResponse(value: unknown): value is AvailabilityResponse {
  if (
    !record(value) ||
    !isMonth(value.month) ||
    typeof value.timeZone !== 'string' ||
    !isCalendarDate(value.today) ||
    !isModality(value.modality) ||
    value.durationMinutes !== gameDuration[value.modality] ||
    !Array.isArray(value.days)
  ) {
    return false;
  }
  const dates = monthDates(value.month);
  return (
    value.days.length === dates.length &&
    value.days.every(
      (day, index) =>
        record(day) &&
        day.date === dates[index] &&
        ['available', 'full', 'closed', 'past'].includes(String(day.status)) &&
        Array.isArray(day.windows) &&
        day.windows.every(isTimeRange) &&
        Array.isArray(day.freeRanges) &&
        day.freeRanges.every(isTimeRange) &&
        (day.startTimes === null ||
          (Array.isArray(day.startTimes) && day.startTimes.every(isClockTime))) &&
        Array.isArray(day.occupancies) &&
        day.occupancies.every(
          (occupancy) => isCourtOccupancy(occupancy) && occupancy.date === day.date,
        ),
    ) &&
    (value.selection === undefined ||
      (record(value.selection) &&
        dates.includes(String(value.selection.date)) &&
        isClockTime(value.selection.start) &&
        (isClockTime(value.selection.end) || value.selection.end === '24:00') &&
        typeof value.selection.available === 'boolean' &&
        minutes(value.selection.end) - minutes(value.selection.start) === value.durationMinutes))
  );
}
