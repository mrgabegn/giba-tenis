import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoClient } from 'mongodb';
import { isHealthResponse } from '@giba-tenis/contracts';
import health from '../api/health.ts';
import { ConfigurationError, getDatabaseConfig } from '../src/config.ts';
import { createReadinessHandler } from '../src/readiness.ts';
import { closeDatabase, getDatabase } from '../src/mongodb.ts';

const url = 'https://api.example.test/api/readiness';
const secret = 'test-only-readiness-token';
function request(token?: string, method = 'GET') {
  return new Request(url, { method, headers: token ? { Authorization: token } : {} });
}

test('health responde sem configuração nem conexão de banco', async () => {
  const response = health.fetch(new Request('https://api.example.test/api/health'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.ok(isHealthResponse(await response.json()));
});

test('health recusa métodos de escrita', async () => {
  const response = health.fetch(new Request(url, { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});

test('readiness fica desabilitado sem token e não consulta o banco', async () => {
  let calls = 0;
  const handler = createReadinessHandler({
    token: () => undefined,
    ping: async () => {
      calls++;
    },
  });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls, 0);
});

test('readiness rejeita acesso sem autorização antes de acessar MongoDB', async () => {
  let calls = 0;
  const handler = createReadinessHandler({
    token: () => secret,
    ping: async () => {
      calls++;
    },
  });
  for (const token of [undefined, `Bearer ${secret}x`, `Basic ${secret}`, 'Bearer invalid']) {
    assert.equal((await handler(request(token))).status, 401);
  }
  assert.equal(calls, 0);
});

test('readiness rejeita token incorreto de mesmo tamanho', async () => {
  const handler = createReadinessHandler({ token: () => secret, ping: async () => undefined });
  const response = await handler(request(`Bearer ${'x'.repeat(secret.length)}`));
  assert.equal(response.status, 401);
});

test('readiness confirma o ping autenticado', async () => {
  let calls = 0;
  const handler = createReadinessHandler({
    token: () => secret,
    ping: async () => {
      calls++;
    },
  });
  const response = await handler(request(`Bearer ${secret}`));
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { status: 'ready', checks: { mongodb: 'ok' } });
});

test('falha do driver retorna 503 sem expor a URI, credenciais ou erro interno', async () => {
  const sensitive = 'mongodb+srv://admin:super-secret@private-cluster.example/';
  const handler = createReadinessHandler({
    token: () => secret,
    ping: async () => {
      throw new Error(sensitive);
    },
  });
  const response = await handler(request(`Bearer ${secret}`));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'not_ready',
    checks: { mongodb: 'unavailable' },
  });
});

test('readiness recusa POST mesmo quando o token está correto', async () => {
  const handler = createReadinessHandler({ token: () => secret, ping: async () => undefined });
  assert.equal((await handler(request(`Bearer ${secret}`, 'POST'))).status, 405);
});

test('configuração ausente não revela valores de ambiente na mensagem de erro', () => {
  assert.throws(() => getDatabaseConfig({ MONGODB_URI: 'sensitive-value' }), ConfigurationError);
});

test('configuração aceita conexão local e Atlas com banco explícito', () => {
  for (const uri of ['mongodb://localhost:27017', 'mongodb+srv://user:pass@cluster.example/']) {
    assert.deepEqual(getDatabaseConfig({ MONGODB_URI: uri, MONGODB_DATABASE: 'giba_quadra_dev' }), {
      uri,
      database: 'giba_quadra_dev',
    });
  }
});

test('configuração recusa banco vazio, nome inválido e protocolo incompatível', () => {
  for (const database of ['', 'bad/name', 'bad name', 'bad.name', 'bad$name']) {
    assert.throws(
      () => getDatabaseConfig({ MONGODB_URI: 'mongodb://localhost', MONGODB_DATABASE: database }),
      ConfigurationError,
    );
  }
  assert.throws(
    () =>
      getDatabaseConfig({ MONGODB_URI: 'https://example.test', MONGODB_DATABASE: 'giba_quadra' }),
    ConfigurationError,
  );
});

test('contrato recusa resposta parcial, formato de outro serviço e timestamp inválido', () => {
  for (const value of [
    null,
    {},
    { status: 'ok' },
    {
      status: 'ok',
      service: 'giba-tenis-api',
      apiVersion: 1,
      timestamp: 'invalid',
    },
    {
      status: 'ok',
      service: 'other-api',
      apiVersion: 1,
      timestamp: new Date().toISOString(),
    },
  ]) {
    assert.equal(isHealthResponse(value), false);
  }
});

test('requisições concorrentes compartilham uma única tentativa de conexão', async (context) => {
  const previousUri = process.env.MONGODB_URI;
  const previousDatabase = process.env.MONGODB_DATABASE;
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018';
  process.env.MONGODB_DATABASE = 'giba_quadra_pool_test';
  context.after(async () => {
    await closeDatabase();
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousDatabase === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = previousDatabase;
  });
  let calls = 0;
  context.mock.method(MongoClient.prototype, 'connect', async function (this: MongoClient) {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return this;
  });
  const databases = await Promise.all([getDatabase(), getDatabase(), getDatabase()]);
  assert.equal(calls, 1);
  assert.ok(databases.every((database) => database.databaseName === 'giba_quadra_pool_test'));
});

test('uma falha inicial permite nova tentativa de conexão', async (context) => {
  const previousUri = process.env.MONGODB_URI;
  const previousDatabase = process.env.MONGODB_DATABASE;
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018';
  process.env.MONGODB_DATABASE = 'giba_quadra_retry_test';
  context.after(async () => {
    await closeDatabase();
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousDatabase === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = previousDatabase;
  });
  let calls = 0;
  context.mock.method(MongoClient.prototype, 'connect', async function (this: MongoClient) {
    calls++;
    if (calls === 1) throw new Error('temporary-connection-failure');
    return this;
  });
  await assert.rejects(getDatabase(), /temporary-connection-failure/);
  assert.equal((await getDatabase()).databaseName, 'giba_quadra_retry_test');
  assert.equal(calls, 2);
});
