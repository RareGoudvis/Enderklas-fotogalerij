// POST /api/admin/wipe — jaarlijkse opkuis (brief §10). Vereist het typen van
// "WISSEN". Verwijdert alle album-objecten, reset alle manifests, MAAR behoudt
// admins.json + teachers.json. Idempotent — veilig om opnieuw te draaien.

import { CLASS_IDS } from '../../../src/config/classes';
import type { Env } from '../env';
import { manifestPath } from '../lib/album';
import type { AuthData } from '../lib/auth';
import { requireAdmin } from '../lib/guard';
import { error, json } from '../lib/respond';
import { getStorage } from '../storage';

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  let body: { confirm?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  if (body.confirm !== 'WISSEN') return error('Typ WISSEN om te bevestigen.', 400);

  const bucket = ctx.env.BUCKET;

  // 1) Alle objecten onder albums/ verwijderen (cursor-lus, gebatcht).
  let deleted = 0;
  let freedBytes = 0;
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix: 'albums/', cursor, limit: 1000 });
    const keys = listing.objects.map((o) => {
      freedBytes += o.size;
      return o.key;
    });
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  // 2) Alle manifests resetten naar leeg.
  const storage = getStorage(ctx.env);
  await Promise.all(
    CLASS_IDS.map((id) => storage.writeJson(manifestPath(id), { albums: [] })),
  );

  // admins.json + teachers.json blijven bewust staan (brief §10).
  return json({ ok: true, deletedObjects: deleted, freedBytes });
};
