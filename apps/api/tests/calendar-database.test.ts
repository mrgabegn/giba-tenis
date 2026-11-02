import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isAvailabilityResponse, type CourtSchedule } from '@giba-quadra/contracts';
import {
  authenticateCalendar,
  hashAccessToken,
  readCalendarMonth,
  type CalendarSession,
} from '../src/calendar-store.ts';
import { createAvailabilityHandler } from '../src/availability.ts';
import { closeDatabase, getDatabase } from '../src/mongodb.ts';

test(
  'MongoDB real: publicação, importação idempotente, autorização e privacidade',
  { skip: !process.env.CALENDAR_TEST_MONGODB_URI },
  async (context) => {
    const previousUri = process.env.MONGODB_URI;
    const previousDatabase = process.env.MONGODB_DATABASE;
    process.env.MONGODB_URI = process.env.CALENDAR_TEST_MONGODB_URI;
    process.env.MONGODB_DATABASE = `giba_calendar_test_${randomUUID().replaceAll('-', '')}`;
    const directory = await mkdtemp(join(tmpdir(), 'giba-calendar-'));
    const database = await getDatabase();
    context.after(async () => {
      await database.dropDatabase();
      await closeDatabase();
      await rm(directory, { recursive: true, force: true });
      if (previousUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = previousUri;
      if (previousDatabase === undefined) delete process.env.MONGODB_DATABASE;
      else process.env.MONGODB_DATABASE = previousDatabase;
    });
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    const run = (script: string, ...args: string[]) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', `scripts/${script}.ts`, ...args],
        { cwd, env: process.env, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const occupancyFile = join(directory, 'occupancies.json');
    await writeFile(
      occupancyFile,
      JSON.stringify([
        {
          date: '2026-11-02',
          start: '09:00',
          end: '10:15',
          kind: 'lesson',
          responsibleName: 'Aluno privado da integração',
        },
      ]),
    );
    run('configure-calendar', 'config/court-schedule.json', occupancyFile);
    run('configure-calendar', 'config/court-schedule.json', occupancyFile);
    assert.equal(await database.collection('court_occupancies').countDocuments(), 1);
    assert.ok(
      await database
        .collection<CourtSchedule & { _id: string }>('court_settings')
        .findOne({ _id: 'main' }),
    );
    const indexes = await database.collection('calendar_sessions').indexes();
    assert.ok(indexes.some((index) => index.expireAfterSeconds === 0));

    const output = run('create-calendar-access', 'member', '1');
    const token = output.trim().split('\n').at(-1)!;
    assert.match(token, /^[a-f0-9]{64}$/);
    const sessions = database.collection<CalendarSession>('calendar_sessions');
    assert.equal(await sessions.countDocuments({ _id: token }), 0);
    const session = await sessions.findOne({ _id: hashAccessToken(token) });
    assert.equal(session?.role, 'member');
    await sessions.updateOne(
      { _id: hashAccessToken(token) },
      { $set: { expiresAt: new Date('2099-12-01T00:00:00Z') } },
    );
    const api = createAvailabilityHandler({
      authenticate: authenticateCalendar,
      readMonth: readCalendarMonth,
      now: () => new Date('2026-11-02T09:00:00Z'),
    });
    const request = (access = token, extra: HeadersInit = {}) =>
      new Request(
        'https://api.test/api/availability?month=2026-11&modality=singles&date=2026-11-02&start=08:00',
        { headers: { Authorization: `Bearer ${access}`, ...extra } },
      );
    let response = await api(request(token, { 'X-Role': 'admin' }));
    let body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(isAvailabilityResponse(body));
    assert.equal(body.selection?.available, false);
    assert.equal(JSON.stringify(body).includes('Aluno privado'), false);

    for (const role of ['admin', 'teacher'] as const) {
      await sessions.updateOne({ _id: hashAccessToken(token) }, { $set: { role } });
      response = await api(request());
      body = await response.json();
      assert.equal(
        body.days.find((day: { date: string }) => day.date === '2026-11-02').occupancies[0]
          .responsibleName,
        'Aluno privado da integração',
      );
    }
    await sessions.updateOne({ _id: hashAccessToken(token) }, { $set: { disabled: true } });
    assert.equal((await api(request())).status, 401);
    // Evitar que a remoção assíncrona do TTL interfira no teste de expiração da autorização.
    await sessions.dropIndex(indexes.find((index) => index.expireAfterSeconds === 0)!.name!);
    await sessions.updateOne(
      { _id: hashAccessToken(token) },
      { $set: { disabled: false, expiresAt: new Date('2026-11-01T00:00:00Z') } },
    );
    assert.equal((await api(request())).status, 401);
    await sessions.updateOne(
      { _id: hashAccessToken(token) },
      { $set: { expiresAt: new Date('2099-12-01T00:00:00Z'), role: 'member' } },
    );
    assert.equal((await api(request('a'.repeat(64)))).status, 401);

    const invalid = await database
      .collection('court_occupancies')
      .insertOne({ date: '2026-11-02', start: 'invalid', end: '12:00' });
    response = await api(request());
    assert.equal(response.status, 503); // falhar fechado em vez de ignorar uma ocupação inválida
    await database.collection('court_occupancies').deleteOne({ _id: invalid.insertedId });
    await database
      .collection<CourtSchedule & { _id: string }>('court_settings')
      .deleteOne({ _id: 'main' });
    response = await api(request());
    assert.deepEqual(await response.json(), { error: 'schedule_not_configured' });
  },
);
