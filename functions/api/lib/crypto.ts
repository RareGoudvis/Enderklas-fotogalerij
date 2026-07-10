// Wachtwoord-hashing (brief §3b).
//
// PBKDF2-SHA256 via WebCrypto — BEWUST niet bcrypt. bcrypt-libraries knallen
// door het CPU-budget van Cloudflare Workers; PBKDF2 via crypto.subtle is het
// canonieke Workers-patroon. ~100k iteraties + per-gebruiker salt. Publiek
// reviewbaar door school-IT, dus expliciet becommentarieerd.
//
// Opslagformaat: `pbkdf2$<iteraties>$<salt-b64>$<hash-b64>` — self-describing,
// zodat het iteratie-aantal later kan stijgen zonder bestaande hashes te breken.

const ITERATIONS = 100_000;
const HASH_BYTES = 32; // 256-bit afgeleide sleutel
const SALT_BYTES = 16;

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Hash een wachtwoord met een verse random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

/**
 * Verifieer een wachtwoord tegen een opgeslagen hash.
 * Vergelijking is constant-tijd om timing-lekken te vermijden.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  const salt = fromB64(parts[2]);
  const expected = fromB64(parts[3]);
  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/** Constant-tijd byte-vergelijking. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
