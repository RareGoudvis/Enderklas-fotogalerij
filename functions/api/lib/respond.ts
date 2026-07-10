// Kleine response-helpers, gedeeld door alle routes. Consistente JSON +
// Nederlandse foutmeldingen.

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function error(message: string, status: number, headers: Record<string, string> = {}): Response {
  return json({ error: message }, status, headers);
}

export const unauthorized = () => error('Niet aangemeld.', 401);
export const forbidden = () => error('Geen toegang.', 403);
export const notFound = () => error('Niet gevonden.', 404);
