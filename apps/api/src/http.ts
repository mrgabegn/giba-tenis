export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const combined = new Headers(headers);
  combined.set('Cache-Control', 'no-store');
  combined.set('X-Content-Type-Options', 'nosniff');
  return Response.json(body, {
    status,
    headers: combined,
  });
}

export function requireGet(request: Request): Response | undefined {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  return undefined;
}
