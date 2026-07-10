// Gedeelde HMAC- en base64url-helpers. Gebruikt door de sessiecookie (session.ts)
// en de share-tokens (tokens.ts, Sprint 3). Eén implementatie, geen duplicatie.

const encoder = new TextEncoder();

/** base64url-encode (zonder padding) van ruwe bytes. */
export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url-decode naar ruwe bytes. */
export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64url-encode van een UTF-8 string. */
export function b64urlEncodeStr(s: string): string {
  return b64urlEncode(encoder.encode(s));
}

/** base64url-decode naar een UTF-8 string. */
export function b64urlDecodeStr(s: string): string {
  return new TextDecoder().decode(b64urlDecode(s));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** HMAC-SHA256 van een bericht met een secret → ruwe bytes. */
export async function hmacSha256(message: string, secret: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
}

/** Constant-tijd stringvergelijking (voor signature-checks). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
