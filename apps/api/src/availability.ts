import {
  isCalendarDate,
  isClockTime,
  isModality,
  isMonth,
  minutes,
  type CalendarRole,
  type CourtOccupancy,
  type CourtSchedule,
} from '@giba-quadra/contracts';
import { buildAvailability, withSelection } from './calendar.ts';
import { ScheduleNotConfigured } from './calendar-store.ts';
import { jsonResponse, requireGet } from './http.ts';

type Dependencies = {
  authenticate: (request: Request, now: Date) => Promise<CalendarRole | null>;
  readMonth: (month: string) => Promise<{ schedule: CourtSchedule; occupancies: CourtOccupancy[] }>;
  now?: () => Date;
  allowedOrigins?: () => string[];
};

export function createAvailabilityHandler({
  authenticate,
  readMonth,
  now = () => new Date(),
  allowedOrigins = () => [],
}: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins().includes(origin))
      return jsonResponse({ error: 'origin_not_allowed' }, 403);
    const headers: Record<string, string> = origin
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};
    const respond = (body: unknown, status = 200, extra: HeadersInit = {}) =>
      jsonResponse(body, status, { ...headers, ...Object.fromEntries(new Headers(extra)) });
    if (request.method === 'OPTIONS') {
      return respond({}, 200, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization',
        'Access-Control-Max-Age': '600',
      });
    }
    const rejected = requireGet(request);
    if (rejected) return respond({ error: 'method_not_allowed' }, 405, { Allow: 'GET, OPTIONS' });
    try {
      const instant = now();
      const role = await authenticate(request, instant);
      if (!role) return respond({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
      const query = new URL(request.url).searchParams;
      const month = query.get('month');
      const modality = query.get('modality');
      const date = query.get('date');
      const start = query.get('start');
      if (
        !isMonth(month) ||
        !isModality(modality) ||
        ((date !== null || start !== null) &&
          (!isCalendarDate(date) ||
            !date.startsWith(`${month}-`) ||
            !isClockTime(start) ||
            minutes(start) + (modality === 'singles' ? 90 : 120) > 1440))
      ) {
        return respond({ error: 'invalid_query' }, 400);
      }
      const data = await readMonth(month);
      const body = buildAvailability({ ...data, month, modality, role, now: now() });
      return respond(date && start ? withSelection(body, date, start) : body);
    } catch (error) {
      return respond(
        {
          error:
            error instanceof ScheduleNotConfigured
              ? 'schedule_not_configured'
              : 'availability_unavailable',
        },
        503,
      );
    }
  };
}
