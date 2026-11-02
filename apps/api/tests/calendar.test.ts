import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  canSelectStart,
  isAvailabilityResponse,
  isCalendarDate,
  isCourtSchedule,
  monthDates,
  type CourtOccupancy,
  type CourtSchedule,
} from '@giba-quadra/contracts';
import { buildAvailability, courtClock, withSelection } from '../src/calendar.ts';
import { createAvailabilityHandler } from '../src/availability.ts';
import {
  authenticateCalendar,
  hashAccessToken,
  ScheduleNotConfigured,
} from '../src/calendar-store.ts';

const config: CourtSchedule = JSON.parse(
  await readFile(new URL('../config/court-schedule.json', import.meta.url), 'utf8'),
);
const instant = new Date('2026-11-02T09:00:00Z'); // segunda-feira, 06:00 na quadra
const date = '2026-11-02';
const occupancy: CourtOccupancy = {
  date,
  start: '09:00',
  end: '10:15',
  kind: 'lesson',
  responsibleName: 'Nome privado do aluno',
};
function availability(overrides: Partial<Parameters<typeof buildAvailability>[0]> = {}) {
  return buildAvailability({
    month: '2026-11',
    modality: 'singles',
    schedule: structuredClone(config),
    occupancies: [],
    role: 'member',
    now: instant,
    ...overrides,
  });
}
function day(body = availability(), value = date) {
  return body.days.find((item) => item.date === value)!;
}
function handler(overrides: Partial<Parameters<typeof createAvailabilityHandler>[0]> = {}) {
  return createAvailabilityHandler({
    authenticate: async () => 'member',
    readMonth: async () => ({ schedule: config, occupancies: [occupancy] }),
    now: () => instant,
    ...overrides,
  });
}
function request(
  query = 'month=2026-11&modality=singles',
  method = 'GET',
  headers: HeadersInit = {},
) {
  return new Request(`https://api.example.test/api/availability?${query}`, { method, headers });
}

test('configuração inicial segue a proposta provisória: seg-sex 07–22, fim de semana fechado e nenhuma grade fixa', () => {
  assert.ok(isCourtSchedule(config));
  const body = availability();
  assert.ok(isAvailabilityResponse(body));
  assert.equal(body.days.length, 30);
  assert.equal(day().startTimes, null);
  assert.deepEqual(day().freeRanges, [{ start: '07:00', end: '22:00' }]);
  assert.equal(day(body, '2026-11-07').status, 'closed');
  assert.equal(day(body, '2026-11-08').status, 'closed');
  assert.equal(canSelectStart(day(), '08:17', 90), true);
});

test('simples ocupa 90 min e duplas 120 min; o jogo inteiro precisa caber antes do fechamento', () => {
  const singles = availability();
  const doubles = availability({ modality: 'doubles' });
  assert.equal(singles.durationMinutes, 90);
  assert.equal(doubles.durationMinutes, 120);
  assert.equal(canSelectStart(day(singles), '20:30', 90), true);
  assert.equal(canSelectStart(day(singles), '20:31', 90), false);
  assert.equal(canSelectStart(day(doubles), '20:00', 120), true);
  assert.equal(canSelectStart(day(doubles), '20:01', 120), false);
  assert.equal(canSelectStart(day(), '06:59', 90), false);
  assert.equal(canSelectStart(day(), '25:00', 90), false);
});

test('aulas, jogos e bloqueios impedem sobreposição, permitindo terminar ou iniciar exatamente na borda', () => {
  for (const kind of ['lesson', 'booking', 'block'] as const) {
    const body = availability({ occupancies: [{ ...occupancy, kind }] });
    assert.equal(canSelectStart(day(body), '07:30', 90), true);
    assert.equal(canSelectStart(day(body), '07:31', 90), false);
    assert.equal(canSelectStart(day(body), '09:00', 90), false);
    assert.equal(canSelectStart(day(body), '10:15', 90), true);
  }
});

test('ocupações sobrepostas/fora da janela não liberam intervalos indevidos', () => {
  const body = availability({
    occupancies: [
      { ...occupancy, start: '10:00', end: '12:00' },
      { ...occupancy, start: '08:00', end: '11:00' },
      { ...occupancy, start: '06:00', end: '07:30' },
      { ...occupancy, start: '21:00', end: '23:00' },
    ],
  });
  assert.deepEqual(day(body).freeRanges, [{ start: '12:00', end: '21:00' }]);
});

test('um dia sem intervalo suficiente fica sem vagas para a modalidade', () => {
  const body = availability({ occupancies: [{ ...occupancy, start: '08:00', end: '21:00' }] });
  assert.equal(day(body).status, 'full');
  assert.deepEqual(day(body).freeRanges, []);
});

test('grade explícita aceita somente os inícios publicados pelo administrador', () => {
  const schedule = structuredClone(config);
  schedule.weekly.find((item) => item.weekday === 1)!.startTimes = ['08:17', '20:30'];
  const body = availability({ schedule });
  assert.equal(canSelectStart(day(body), '08:17', 90), true);
  assert.equal(canSelectStart(day(body), '08:30', 90), false);
  assert.equal(
    canSelectStart(day(availability({ schedule, modality: 'doubles' })), '20:30', 120),
    false,
  );
  schedule.weekly.find((item) => item.weekday === 1)!.startTimes = [];
  assert.equal(day(availability({ schedule })).status, 'full');
});

test('exceções permitem feriado fechado e abertura extraordinária em sábado', () => {
  const schedule = structuredClone(config);
  schedule.overrides = [
    { date, windows: [] },
    { date: '2026-11-07', windows: [{ start: '10:00', end: '13:00' }], startTimes: ['10:15'] },
  ];
  const body = availability({ schedule });
  assert.equal(day(body).status, 'closed');
  assert.equal(canSelectStart(day(body, '2026-11-07'), '10:15', 90), true);
  assert.equal(canSelectStart(day(body, '2026-11-07'), '10:30', 90), false);
});

test('datas e horários passados seguem o fuso da quadra, incluindo virada de dia UTC e milissegundos', () => {
  assert.deepEqual(courtClock(new Date('2026-11-03T01:00:00Z'), config.timeZone), {
    date,
    minute: 1320,
  });
  assert.equal(day(availability({ now: new Date('2026-11-03T10:00:00Z') })).status, 'past');
  assert.equal(
    canSelectStart(day(availability({ now: new Date('2026-11-02T10:00:00Z') })), '07:00', 90),
    true,
  );
  assert.equal(
    canSelectStart(day(availability({ now: new Date('2026-11-02T10:00:00.001Z') })), '07:00', 90),
    false,
  );
  assert.equal(
    canSelectStart(day(availability({ now: new Date('2026-11-02T10:00:01Z') })), '07:01', 90),
    true,
  );
});

test('nomes e identificadores são removidos no servidor para sócios; professor e administrador podem ver o nome', () => {
  const privateRecord = {
    ...occupancy,
    _id: 'private-id',
    memberId: 'member-private',
    participants: ['private-participant'],
  };
  const memberBody = JSON.stringify(availability({ occupancies: [privateRecord] }));
  for (const value of [
    'Nome privado',
    'private-id',
    'member-private',
    'private-participant',
    'responsibleName',
    'memberId',
  ])
    assert.equal(memberBody.includes(value), false);
  for (const role of ['admin', 'teacher'] as const)
    assert.equal(
      day(availability({ occupancies: [privateRecord], role })).occupancies[0].responsibleName,
      occupancy.responsibleName,
    );
});

test('calendário inclui anos bissextos e recusa datas impossíveis', () => {
  assert.equal(monthDates('2028-02').length, 29);
  assert.equal(monthDates('2027-02').length, 28);
  for (const value of ['2026-11-31', '2026-02-29', '2026-13-01', '2026-00-01', 'invalid'])
    assert.equal(isCalendarDate(value), false);
  assert.equal(isCalendarDate('2028-02-29'), true);
});

test('validação rejeita configuração ambígua, intervalos inválidos, grade fora da janela e fuso inexistente', () => {
  for (const mutate of [
    (value: CourtSchedule) => {
      value.weekly[0].weekday = 1;
    },
    (value: CourtSchedule) => {
      value.weekly[1].windows = [{ start: '22:00', end: '07:00' }];
    },
    (value: CourtSchedule) => {
      value.weekly[1].windows.push({ start: '08:00', end: '10:00' });
    },
    (value: CourtSchedule) => {
      value.weekly[1].startTimes = ['06:00'];
    },
    (value: CourtSchedule) => {
      value.weekly[1].startTimes = ['08:00', '08:00'];
    },
    (value: CourtSchedule) => {
      value.timeZone = 'Invalid/Zone';
    },
    (value: CourtSchedule) => {
      value.overrides = [{ date: '2026-11-31', windows: [] }];
    },
  ]) {
    const value = structuredClone(config);
    mutate(value);
    assert.equal(isCourtSchedule(value), false);
  }
});

test('API verifica autenticação antes de consultar a agenda', async () => {
  let reads = 0;
  const response = await handler({
    authenticate: async () => null,
    readMonth: async () => {
      reads++;
      throw new Error();
    },
  })(request());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Bearer');
  assert.equal(reads, 0);
  // Ausência de credencial nunca tenta conexão com o banco.
  assert.equal(await authenticateCalendar(request(), instant), null);
  assert.equal(
    await authenticateCalendar(request('', 'GET', { Authorization: 'Bearer invalid' }), instant),
    null,
  );
  assert.notEqual(hashAccessToken('a'.repeat(64)), 'a'.repeat(64));
});

test('API recusa consultas inválidas antes de acessar disponibilidade', async () => {
  let reads = 0;
  const api = handler({
    readMonth: async () => {
      reads++;
      return { schedule: config, occupancies: [] };
    },
  });
  for (const query of [
    '',
    'month=2026-13&modality=singles',
    'month=2026-11&modality=other',
    'month=2026-11&modality=singles&date=2026-11-31&start=07:00',
    'month=2026-11&modality=singles&date=2026-12-01&start=07:00',
    'month=2026-11&modality=singles&start=07:00',
    'month=2026-11&modality=singles&date=2026-11-02',
    'month=2026-11&modality=doubles&date=2026-11-02&start=23:00',
  ])
    assert.equal((await api(request(query))).status, 400, query);
  assert.equal(reads, 0);
});

test('API revalida a seleção usando as ocupações atuais e não cria uma reserva', async () => {
  let occupancies: CourtOccupancy[] = [];
  const api = handler({ readMonth: async () => ({ schedule: config, occupancies }) });
  const query = `month=2026-11&modality=singles&date=${date}&start=08:00`;
  let response = await api(request(query));
  let body = await response.json();
  assert.ok(isAvailabilityResponse(body));
  assert.deepEqual(body.selection, { date, start: '08:00', end: '09:30', available: true });
  occupancies = [occupancy];
  response = await api(request(query));
  body = await response.json();
  assert.equal(body.selection.available, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('API trata falhas sem revelar dados internos e distingue agenda ainda não publicada', async () => {
  const response = await handler({
    readMonth: async () => {
      throw new Error('mongodb://admin:secret@host');
    },
  })(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'availability_unavailable' });
  const unconfigured = await handler({
    readMonth: async () => {
      throw new ScheduleNotConfigured();
    },
  })(request());
  assert.deepEqual(await unconfigured.json(), { error: 'schedule_not_configured' });
});

test('API aceita somente leitura e libera CORS apenas para origens configuradas', async () => {
  let authentications = 0;
  const api = handler({
    allowedOrigins: () => ['http://localhost:8081'],
    authenticate: async () => {
      authentications++;
      return 'member';
    },
  });
  const origin = { Origin: 'http://localhost:8081' };
  const preflight = await api(request('', 'OPTIONS', origin));
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'Authorization');
  assert.equal(authentications, 0);
  assert.equal((await api(request('', 'GET', { Origin: 'https://untrusted.test' }))).status, 403);
  assert.equal(authentications, 0);
  assert.equal((await api(request('', 'POST', origin))).status, 405);
  const response = await api(request(undefined, 'GET', origin));
  assert.equal(response.headers.get('access-control-allow-origin'), origin.Origin);
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.ok(isAvailabilityResponse(await response.json()));
});

test('cliente rejeita respostas de calendário incompletas e durações incompatíveis', () => {
  const body = availability();
  assert.ok(isAvailabilityResponse(withSelection(body, date, '07:00')));
  for (const candidate of [
    null,
    {},
    { ...body, durationMinutes: 60 },
    { ...body, days: [] },
    { ...body, days: [{ ...day(body), date: '2026-11-31' }, ...body.days.slice(1)] },
    { ...body, selection: { date, start: '07:00', end: '07:30', available: true } },
  ])
    assert.equal(isAvailabilityResponse(candidate), false);
});
