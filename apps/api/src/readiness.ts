import { timingSafeEqual } from 'node:crypto';
import type { ReadinessResponse } from '@giba-quadra/contracts';
import { jsonResponse, requireGet } from './http.ts';

type Dependencies = {
  ping: () => Promise<void>;
  token: () => string | undefined;
};

export function createReadinessHandler({ ping, token }: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const rejected = requireGet(request);
    if (rejected) return rejected;
    const expected = token()?.trim();
    if (!expected) return jsonResponse({ error: 'readiness_not_configured' }, 503);
    const supplied = request.headers.get('authorization') ?? '';
    const expectedHeader = Buffer.from(`Bearer ${expected}`);
    const suppliedHeader = Buffer.from(supplied);
    if (
      expectedHeader.length !== suppliedHeader.length ||
      !timingSafeEqual(expectedHeader, suppliedHeader)
    ) {
      return jsonResponse({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
    }
    try {
      await ping();
      const body: ReadinessResponse = { status: 'ready', checks: { mongodb: 'ok' } };
      return jsonResponse(body);
    } catch {
      // Mensagens do driver podem conter hosts e credenciais. Não retorná-las ao cliente.
      const body: ReadinessResponse = {
        status: 'not_ready',
        checks: { mongodb: 'unavailable' },
      };
      return jsonResponse(body, 503);
    }
  };
}
