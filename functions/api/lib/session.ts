// Sessiecookie (brief §3b/§4).
//
// Zelfde ondertekende cookie voor beide auth-modi (password/sso). Formaat:
//   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
// Geen server-side sessie-opslag: de cookie is self-verifying, net als de
// share-tokens. 90 dagen geldig — een leerkracht typt ~1x per toestel per
// schooljaar zijn wachtwoord.

import { b64urlDecodeStr, b64urlEncode, b64urlEncodeStr, hmacSha256, timingSafeEqualStr } from './hmac';

const MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 dagen
export const SESSION_COOKIE = 'basl_session';

export interface SessionPayload {
  /** 4-letterige gebruikersnaam. */
  username: string;
  email: string;
  /** Uitgifte- en vervaltijd in epoch-seconden. */
  iat: number;
  exp: number;
  /**
   * Optionele Noodupload-bypass tot epoch-ms (brief §6, Sprint 6). Enkel
   * gehonoreerd voor admins; self-disarming op vervaltijd.
   */
  bypassUntil?: number;
}

/** Onderteken een payload → cookiewaarde. `now` in epoch-seconden. */
export async function signSession(
  data: Pick<SessionPayload, 'username' | 'email' | 'bypassUntil'>,
  secret: string,
  now: number,
): Promise<string> {
  const payload: SessionPayload = {
    username: data.username,
    email: data.email,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
    ...(data.bypassUntil !== undefined ? { bypassUntil: data.bypassUntil } : {}),
  };
  const body = b64urlEncodeStr(JSON.stringify(payload));
  const sig = b64urlEncode(await hmacSha256(body, secret));
  return `${body}.${sig}`;
}

/** Verifieer een cookiewaarde → payload, of null bij ongeldig/verlopen. */
export async function verifySession(
  token: string,
  secret: string,
  now: number,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64urlEncode(await hmacSha256(body, secret));
  if (!timingSafeEqualStr(sig, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecodeStr(body)) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}

/** Bouw de Set-Cookie-header voor een sessie (HttpOnly, Secure, SameSite=Lax). */
export function sessionCookieHeader(value: string): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');
}

/** Set-Cookie-header die de sessie wist (uitloggen). */
export function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Lees de sessiecookie uit een Request. */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return v.join('=');
  }
  return null;
}
