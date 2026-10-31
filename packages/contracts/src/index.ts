export type HealthResponse = {
  status: 'ok';
  service: 'giba-quadra-api';
  apiVersion: 1;
  timestamp: string;
};

export type ReadinessResponse = {
  status: 'ready' | 'not_ready';
  checks: { mongodb: 'ok' | 'unavailable' };
};

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === 'ok' &&
    candidate.service === 'giba-quadra-api' &&
    candidate.apiVersion === 1 &&
    typeof candidate.timestamp === 'string' &&
    Number.isFinite(Date.parse(candidate.timestamp))
  );
}
