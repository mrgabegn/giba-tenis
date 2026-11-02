import { createServer } from 'node:http';
import health from '../api/health.ts';
import readiness from '../api/readiness.ts';
import availability from '../api/availability.ts';
import { closeDatabase } from './mongodb.ts';
import { jsonResponse } from './http.ts';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT precisa ser uma porta válida.');
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', `http://127.0.0.1:${port}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(url, { method: incoming.method ?? 'GET', headers });
    const response =
      url.pathname === '/api/health'
        ? health.fetch(request)
        : url.pathname === '/api/readiness'
          ? await readiness.fetch(request)
          : url.pathname === '/api/availability'
            ? await availability.fetch(request)
            : jsonResponse({ error: 'not_found' }, 404);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    outgoing.end(JSON.stringify({ error: 'internal_error' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.info(`API local: http://localhost:${port}/api/health`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });
  });
}
