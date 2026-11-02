import { createAvailabilityHandler } from '../src/availability.ts';
import { authenticateCalendar, readCalendarMonth } from '../src/calendar-store.ts';

export default {
  fetch: createAvailabilityHandler({
    authenticate: authenticateCalendar,
    readMonth: readCalendarMonth,
    allowedOrigins: () =>
      (process.env.CALENDAR_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
  }),
};
