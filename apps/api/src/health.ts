import type { HealthResponse } from '@giba-quadra/contracts';
import { jsonResponse, requireGet } from './http.ts';

export function handleHealth(request: Request): Response {
  const rejected = requireGet(request);
  if (rejected) return rejected;
  const body: HealthResponse = {
    status: 'ok',
    service: 'giba-quadra-api',
    apiVersion: 1,
    timestamp: new Date().toISOString(),
  };
  return jsonResponse(body, 200, { 'Access-Control-Allow-Origin': '*' });
}
