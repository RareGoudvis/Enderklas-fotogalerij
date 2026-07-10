// Share-tokens voor ouders (brief §7). Self-verifying, geen token-opslag.
//
// Token = base64url("<albumId>:<tokenVersion>") + "." + eerste 16 base64url-
// tekens van HMAC-SHA256("<albumId>:<tokenVersion>", SHARE_SECRET).
//
// De signature is BEWUST afgekapt tot 16 base64url-tekens (~96 bit). Dat is
// veilig voor dit dreigingsmodel: een aanvaller kan niet raden tegen een
// rate-limited endpoint, en de link moet kort genoeg blijven om in een
// nieuwsbrief te overleven en desnoods van papier te typen. NIET terugzetten
// naar volledige lengte — dit is een doelbewuste keuze.
//
// Herroepen ("link intrekken") = album.tokenVersion++ → alle oude links sterven.

import { b64urlDecodeStr, b64urlEncode, b64urlEncodeStr, hmacSha256, timingSafeEqualStr } from './lib/hmac';

const SIG_CHARS = 16;

async function signature(payload: string, secret: string): Promise<string> {
  const full = b64urlEncode(await hmacSha256(payload, secret));
  return full.slice(0, SIG_CHARS);
}

/** Genereer een share-token voor een album op een bepaalde tokenVersion. */
export async function signToken(
  albumId: string,
  tokenVersion: number,
  secret: string,
): Promise<string> {
  const payload = `${albumId}:${tokenVersion}`;
  const sig = await signature(payload, secret);
  return `${b64urlEncodeStr(payload)}.${sig}`;
}

/**
 * Verifieer een token → { albumId, tokenVersion } of null bij ongeldig.
 * De aanroeper checkt daarna of tokenVersion nog matcht met het album (revoke).
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ albumId: string; tokenVersion: number } | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let payload: string;
  try {
    payload = b64urlDecodeStr(payloadB64);
  } catch {
    return null;
  }

  const expected = await signature(payload, secret);
  if (!timingSafeEqualStr(sig, expected)) return null;

  const colon = payload.lastIndexOf(':');
  if (colon < 1) return null;
  const albumId = payload.slice(0, colon);
  const tokenVersion = Number(payload.slice(colon + 1));
  if (!albumId || !Number.isInteger(tokenVersion)) return null;

  return { albumId, tokenVersion };
}
