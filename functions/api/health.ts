// GET /api/health — Sprint 1 rooktest.
//
// Bewijst dat de volledige bedrading werkt: Pages Function → storage-factory →
// R2 read/write, inclusief het conditionele-write-pad (ETag). Round-trip een
// klein JSON-object door de bucket en rapporteer het resultaat.

import type { Env } from './env';
import { ConflictError, getStorage } from './storage';

const HEALTH_PATH = 'manifests/_health.json';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const storage = getStorage(env);
  const now = new Date().toISOString();

  try {
    // 1) Onvoorwaardelijke write.
    await storage.writeJson(HEALTH_PATH, { ok: true, ts: now });

    // 2) Teruglezen — levert data + ETag.
    const read = await storage.readJson(HEALTH_PATH);
    if (read === null) {
      return json({ ok: false, error: 'Kon _health.json niet teruglezen' }, 500);
    }

    // 3) Conditionele write met de ETag — bewijst dat het optimistic-locking-pad
    //    werkt (basis voor de manifest-writes in Sprint 3).
    let conditionalWriteOk = false;
    try {
      await storage.writeJson(HEALTH_PATH, { ok: true, ts: now, checked: true }, read.etag);
      conditionalWriteOk = true;
    } catch (e) {
      // Een ConflictError hier zou betekenen dat iets anders tegelijk schreef;
      // voor de rooktest tolereren we dat maar rapporteren het.
      if (!(e instanceof ConflictError)) throw e;
    }

    return json({
      ok: true,
      backend: env.STORAGE_BACKEND,
      etag: read.etag,
      conditionalWriteOk,
      roundTripped: read.data,
      ts: now,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
