// Brute-force-rem (brief §3b): 5 mislukte pogingen per gebruikersnaam →
// 15 minuten lockout. Kleine JSON naast de manifests. Voldoende bij 17
// gebruikers achter Cloudflare.

import { ConflictError, type StorageAdapter } from '../storage';

export const LOCKOUTS_PATH = 'config/lockouts.json';
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface LockEntry {
  fails: number;
  /** Epoch-ms tot wanneer geblokkeerd; 0 = niet geblokkeerd. */
  until: number;
}
type LockFile = Record<string, LockEntry>;

async function read(storage: StorageAdapter): Promise<{ data: LockFile; etag?: string }> {
  const res = await storage.readJson(LOCKOUTS_PATH);
  if (!res) return { data: {} };
  return { data: res.data as LockFile, etag: res.etag };
}

/** Is deze gebruikersnaam momenteel geblokkeerd? */
export async function isLocked(
  storage: StorageAdapter,
  username: string,
  now: number,
): Promise<{ locked: boolean; until: number }> {
  const { data } = await read(storage);
  const entry = data[username];
  if (entry && entry.until > now) return { locked: true, until: entry.until };
  return { locked: false, until: 0 };
}

// Kleine ETag-veilige update met retry-once bij gelijktijdige schrijf.
async function mutate(
  storage: StorageAdapter,
  fn: (data: LockFile) => void,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, etag } = await read(storage);
    fn(data);
    try {
      await storage.writeJson(LOCKOUTS_PATH, data, etag);
      return;
    } catch (e) {
      if (e instanceof ConflictError && attempt === 0) continue; // her-lees en probeer opnieuw
      throw e;
    }
  }
}

/** Registreer een mislukte poging; zet lockout bij de 5e. */
export async function recordFail(
  storage: StorageAdapter,
  username: string,
  now: number,
): Promise<void> {
  await mutate(storage, (data) => {
    const entry = data[username] ?? { fails: 0, until: 0 };
    // Reset de teller als een oude lockout intussen verlopen is.
    if (entry.until !== 0 && entry.until <= now) {
      entry.fails = 0;
      entry.until = 0;
    }
    entry.fails += 1;
    if (entry.fails >= MAX_FAILS) {
      entry.until = now + LOCK_MS;
      entry.fails = 0; // teller reset; de tijdslot is nu de rem
    }
    data[username] = entry;
  });
}

/** Wis de teller na een geslaagde login. */
export async function clearFails(storage: StorageAdapter, username: string): Promise<void> {
  await mutate(storage, (data) => {
    delete data[username];
  });
}
