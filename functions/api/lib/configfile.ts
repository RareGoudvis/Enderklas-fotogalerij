// Generieke ETag-veilige mutatie van een config-JSON (admins/teachers/settings).
// Retry-once bij een gelijktijdige schrijf (brief §5-patroon).

import { ConflictError, type StorageAdapter } from '../storage';

export async function mutateJson<T>(
  storage: StorageAdapter,
  path: string,
  fallback: T,
  fn: (data: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await storage.readJson(path);
    const current = res ? (res.data as T) : fallback;
    const next = fn(current);
    try {
      await storage.writeJson(path, next, res?.etag);
      return next;
    } catch (e) {
      if (e instanceof ConflictError && attempt === 0) continue;
      throw e;
    }
  }
  throw new Error('Kon config niet schrijven');
}
