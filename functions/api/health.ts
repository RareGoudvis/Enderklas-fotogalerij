// GET /api/health — liveness + optionele diepe R2-rooktest.
//
// STANDAARD (geen query): goedkope liveness — GEEN R2-operatie. Bewust, zodat
// anonieme/bot-hits geen storage-operaties (Class A) kosten. Bevestigt enkel dat
// de Function draait en de env gezet is.
//
// DIEP (?deep=1): het volledige write→read→conditionele-write-rondje door R2
// (bewijst binding + EU-bucket + optimistic-locking). Dit SCHRIJFT naar R2 en is
// daarom afgeschermd tot admins — anders kan een bot met ?deep=1 alsnog
// storage-operaties uitlokken. Log in als admin en bezoek dan /api/health?deep=1.

import type { Env } from './env';
import type { AuthData } from './lib/auth';
import { ConflictError, getStorage } from './storage';

const HEALTH_PATH = 'manifests/_health.json';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const { env, request, data } = ctx;
  const deep = new URL(request.url).searchParams.get('deep') === '1';
  const now = new Date().toISOString();

  // Goedkope liveness — geen R2, veilig voor anonieme/bot-verkeer.
  if (!deep) {
    return json({ ok: true, backend: env.STORAGE_BACKEND, ts: now });
  }

  // Diepe check raakt R2 aan → enkel admins (kosten-/misbruikbescherming).
  if (data.user?.role !== 'admin') {
    return json({ ok: false, error: 'Diepe check vereist een admin-sessie.' }, 403);
  }

  const storage = getStorage(env);
  try {
    // 1) Onvoorwaardelijke write.
    await storage.writeJson(HEALTH_PATH, { ok: true, ts: now });

    // 2) Teruglezen — levert data + ETag.
    const read = await storage.readJson(HEALTH_PATH);
    if (read === null) {
      return json({ ok: false, error: 'Kon _health.json niet teruglezen' }, 500);
    }

    // 3) Conditionele write met de ETag — bewijst het optimistic-locking-pad.
    let conditionalWriteOk = false;
    try {
      await storage.writeJson(HEALTH_PATH, { ok: true, ts: now, checked: true }, read.etag);
      conditionalWriteOk = true;
    } catch (e) {
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
