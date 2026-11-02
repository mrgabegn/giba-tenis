import { readFile } from 'node:fs/promises';
import { isCourtOccupancy, isCourtSchedule, type CourtSchedule } from '@giba-quadra/contracts';
import { closeDatabase, getDatabase } from '../src/mongodb.ts';

try {
  // Configuração e importação executadas somente pelo operador, com acesso ao servidor.
  const [scheduleFile = 'config/court-schedule.json', occupanciesFile] = process.argv.slice(2);
  const schedule: unknown = JSON.parse(await readFile(scheduleFile, 'utf8'));
  if (!isCourtSchedule(schedule)) throw new Error('invalid_config');
  const occupancies: unknown = occupanciesFile
    ? JSON.parse(await readFile(occupanciesFile, 'utf8'))
    : [];
  if (!Array.isArray(occupancies) || !occupancies.every(isCourtOccupancy))
    throw new Error('invalid_occupancies');
  const database = await getDatabase();
  await database.collection('court_occupancies').createIndex({ date: 1 });
  await database
    .collection('calendar_sessions')
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // Importação idempotente. Não altera nem remove aulas existentes.
  for (const occupancy of occupancies) {
    await database
      .collection('court_occupancies')
      .updateOne(
        { date: occupancy.date, start: occupancy.start, end: occupancy.end, kind: occupancy.kind },
        { $setOnInsert: { ...occupancy, active: true } },
        { upsert: true },
      );
  }
  await database
    .collection<CourtSchedule & { _id: string }>('court_settings')
    .replaceOne({ _id: 'main' }, schedule, { upsert: true });
  console.info('Configuração da quadra publicada. Ocupações existentes preservadas.');
} catch {
  console.error(
    'Não foi possível configurar a agenda. Confira o JSON, os caminhos e o acesso ao MongoDB.',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
