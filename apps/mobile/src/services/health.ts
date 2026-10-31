import { isHealthResponse, type HealthResponse } from '@giba-tenis/contracts';

export function getApiUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) throw new Error('Defina EXPO_PUBLIC_API_URL em apps/mobile/.env e reinicie o Expo.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL precisa ser uma URL válida.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (!__DEV__ && url.protocol !== 'https:')
  ) {
    throw new Error('Use uma URL de API sem credenciais. Em produção, HTTPS é obrigatório.');
  }
  return raw.replace(/\/+$/, '');
}

export async function checkApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(`${getApiUrl()}/api/health`, { signal: controller.signal });
    if (!response.ok) throw new Error(`A API respondeu com HTTP ${response.status}.`);
    const body: unknown = await response.json();
    if (!isHealthResponse(body)) throw new Error('A resposta não corresponde à API deste projeto.');
    return body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
