// DELETE /api/albums/:id/items/:itemId — één foto verwijderen (brief §4/§5).
//
// De GDPR consent-fix: elke leerkracht met toegang tot het album (of een admin)
// mag een foto meteen verwijderen. Bumpt version → de listing-cache bust binnen
// seconden; de beeld-binary verdwijnt binnen het uur (1u-cap).

import type { Env } from '../../../env';
import { canManageAlbum, findAlbum, mutateManifest } from '../../../lib/album';
import type { AuthData } from '../../../lib/auth';
import { requireUser } from '../../../lib/guard';
import { error, forbidden, json, notFound } from '../../../lib/respond';
import { getStorage } from '../../../storage';

export const onRequestDelete: PagesFunction<Env, 'id' | 'itemId', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;
  const itemId = ctx.params.itemId as string;

  // Padbeveiliging: itemId is een nanoid, geen pad.
  if (!itemId || /[^A-Za-z0-9_-]/.test(itemId)) return error('Ongeldige foto-id.', 400);

  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (!canManageAlbum(user, found.album)) return forbidden();

  // Hoofdbeeld + thumbnail weg.
  await ctx.env.BUCKET.delete([
    `${found.album.folderId}/${itemId}.webp`,
    `${found.album.folderId}/thumbs/${itemId}.webp`,
  ]);

  // Version-bump = directe cache-bust van de listing (brief §8).
  await mutateManifest(storage, found.homeClassId, (albums) =>
    albums.map((a) => (a.id === albumId ? { ...a, version: a.version + 1 } : a)),
  );

  return json({ ok: true, deleted: itemId });
};
