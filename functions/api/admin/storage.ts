// GET /api/admin/storage — opslagoverzicht per klas (brief §9, Opslag-tab).
// Aantal albums/foto's + bytes per klas, plus totaal en de cap-waarschuwing.

import { CLASS_IDS } from '../../../src/config/classes';
import type { Env } from '../env';
import { readManifest } from '../lib/album';
import type { AuthData } from '../lib/auth';
import { requireAdmin } from '../lib/guard';
import { json } from '../lib/respond';
import { bytesToGb } from '../lib/usage';
import { getStorage } from '../storage';

const WARN_GB = 8.5; // waarschuwingsbanner vanaf 8,5 GB (brief §6)

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const bucket = ctx.env.BUCKET;
  const storage = getStorage(ctx.env);

  // Bytes per album-map in één keer opbouwen: doorloop alle objecten en tel op
  // per <classId> (albums/<classId>/…). Zo hoeven we niet per album te listen.
  const bytesByClass: Record<string, number> = {};
  const photosByClass: Record<string, number> = {};
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix: 'albums/', cursor, limit: 1000 });
    for (const o of listing.objects) {
      const parts = o.key.split('/'); // albums / classId / albumId / [thumbs/] file
      const classId = parts[1];
      if (!classId) continue;
      bytesByClass[classId] = (bytesByClass[classId] ?? 0) + o.size;
      // Foto's = hoofdbeelden (niet de thumbs/-submap).
      if (parts.length === 4 && parts[3].endsWith('.webp')) {
        photosByClass[classId] = (photosByClass[classId] ?? 0) + 1;
      }
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  // Album-aantallen uit de manifests (home-klas).
  const perClass = await Promise.all(
    CLASS_IDS.map(async (id) => {
      const { albums } = await readManifest(storage, id);
      return {
        id,
        albums: albums.length,
        photos: photosByClass[id] ?? 0,
        bytes: bytesByClass[id] ?? 0,
      };
    }),
  );

  const totalBytes = perClass.reduce((s, c) => s + c.bytes, 0);
  const capGb = Number(ctx.env.STORAGE_HARD_CAP_GB) || 9.8;
  const usedGb = bytesToGb(totalBytes);

  return json({
    classes: perClass,
    totalBytes,
    usedGb,
    capGb,
    warn: usedGb >= WARN_GB,
    capReached: usedGb >= capGb,
  });
};
