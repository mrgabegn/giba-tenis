import { createHash } from 'node:crypto';
import {
  isCourtOccupancy,
  isCourtSchedule,
  type CalendarRole,
  type CourtSchedule,
} from '@giba-quadra/contracts';
import { getDatabase } from './mongodb.ts';

export type CalendarSession = {
  _id: string;
  role: CalendarRole;
  expiresAt: Date;
  disabled: boolean;
};

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function authenticateCalendar(
  request: Request,
  now: Date,
): Promise<CalendarRole | null> {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '');
  if (!match) return null;
  const database = await getDatabase();
  const session = await database.collection<CalendarSession>('calendar_sessions').findOne({
    _id: hashAccessToken(match[1]),
    disabled: false,
    expiresAt: { $gt: now },
  });
  return session && ['member', 'admin', 'teacher'].includes(session.role) ? session.role : null;
}

export class ScheduleNotConfigured extends Error {}

export async function readCalendarMonth(month: string) {
  const database = await getDatabase();
  const schedule = await database
    .collection<CourtSchedule & { _id: string }>('court_settings')
    .findOne({ _id: 'main' });
  if (!schedule) throw new ScheduleNotConfigured();
  if (!isCourtSchedule(schedule)) throw new Error('Invalid court schedule');
  const documents: unknown[] = await database
    .collection('court_occupancies')
    .find({
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
      active: { $ne: false },
    })
    .toArray();
  if (!documents.every(isCourtOccupancy)) throw new Error('Invalid court occupancy');
  return { schedule, occupancies: documents };
}
