import {
  isAvailabilityResponse,
  type AvailabilityResponse,
  type GameModality,
} from '@giba-quadra/contracts';
import { getApiUrl } from './health';

export class CalendarAccessError extends Error {}

export async function fetchAvailability({
  token,
  month,
  modality,
  selection,
  signal,
}: {
  token: string;
  month: string;
  modality: GameModality;
  selection?: { date: string; start: string };
  signal?: AbortSignal;
}): Promise<AvailabilityResponse> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 10_000);
  try {
    const query = new URLSearchParams({ month, modality, ...selection });
    const response = await fetch(`${getApiUrl()}/api/availability?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (response.status === 401)
      throw new CalendarAccessError(
        'Acesso inválido ou expirado. Solicite um novo código à administração.',
      );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === 'schedule_not_configured')
        throw new Error('A administração ainda não publicou os horários da quadra.');
      throw new Error('Não foi possível consultar a agenda. Tente novamente.');
    }
    const body: unknown = await response.json();
    if (
      !isAvailabilityResponse(body) ||
      body.month !== month ||
      body.modality !== modality ||
      (selection &&
        (body.selection?.date !== selection.date || body.selection.start !== selection.start))
    ) {
      throw new Error('A agenda recebida é inválida. Tente atualizar os horários.');
    }
    return body;
  } catch (error) {
    if (error instanceof CalendarAccessError) throw error;
    if (controller.signal.aborted && !signal?.aborted)
      throw new Error('A consulta demorou demais. Confira sua conexão e tente novamente.');
    if (error instanceof TypeError)
      throw new Error('Sem conexão com a agenda. Confira sua internet e tente novamente.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
