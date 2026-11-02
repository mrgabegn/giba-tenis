import { randomBytes } from 'node:crypto';
import type { CalendarRole } from '@giba-quadra/contracts';
import { hashAccessToken, type CalendarSession } from '../src/calendar-store.ts';
import { closeDatabase, getDatabase } from '../src/mongodb.ts';

try {
  const [role = 'member', validDays = '30'] = process.argv.slice(2);
  const days = Number(validDays);
  if (
    !['member', 'admin', 'teacher'].includes(role) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    throw new Error('invalid_access');
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const database = await getDatabase();
  await database.collection<CalendarSession>('calendar_sessions').insertOne({
    _id: hashAccessToken(token),
    role: role as CalendarRole,
    expiresAt,
    disabled: false,
  });
  console.info(
    `Acesso ${role}, válido até ${expiresAt.toISOString()}. Entregue somente ao usuário autorizado:`,
  );
  console.info(token);
} catch {
  console.error(
    'Não foi possível emitir o acesso. Use member, admin ou teacher e validade de 1 a 365 dias. Confira o MongoDB.',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
