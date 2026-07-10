// DELETE /api/albums/:id — album verwijderen (brief §4/§5).
//
// Toegang: admin, of een contributor die één van de getagde klassen heeft
// (elke getagde leerkracht mag verwijderen — GDPR consent-fix-pad). Verwijdert
// zowel de manifest-entry (in de home-klas) als de R2-objecten.

import type { Env } from '../env';
import { canManageAlbum, findAlbum, mutateManifest } from '../lib/album';
import type { AuthData } from '../lib/auth';
import { requireUser } from '../lib/guard';
import { forbidden, json, notFound } from '../lib/respond';
import { getStorage } from '../storage';

export const onRequestDelete: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (!canManageAlbum(user, found.album)) return forbidden();

  // 1) R2-objecten weg. 2) manifest-entry weg uit de home-klas.
  await storage.deleteAlbumFolder(albumId);
  await mutateManifest(storage, found.homeClassId, (albums) =>
    albums.filter((a) => a.id !== albumId),
  );

  return json({ ok: true, deleted: albumId });
};
