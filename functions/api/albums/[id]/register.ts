// POST /api/albums/:id/register — registreer een voltooide (batch) upload
// (R2-setup.md §3, brief §5). Bumpt het home-manifest: lastUploadAt = nu,
// version++ (cache-bust). BEWUST gedebouncet aan clientzijde (≈1× per 10
// bestanden + aan het einde), en hier met jitter herhaald tot de ETag-write
// landt — meerdere leerkrachten kunnen tegelijk in hetzelfde album uploaden.

import type { Env } from '../../env';
import { findAlbum, mutateManifest } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { authorizeUpload } from '../../lib/guest';
import { json, notFound } from '../../lib/respond';
import { getStorage } from '../../storage';

export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();

  // Zelfde autorisatie als upload: sessie-beheerder óf geldig gast-token.
  const auth = await authorizeUpload(ctx, found.album);
  if (auth instanceof Response) return auth;

  const now = new Date().toISOString();
  await mutateManifest(
    storage,
    found.homeClassId,
    (albums) =>
      albums.map((a) =>
        a.id === albumId
          ? {
              ...a,
              // Merge convergeert altijd: max-timestamp + version++.
              lastUploadAt: a.lastUploadAt && a.lastUploadAt > now ? a.lastUploadAt : now,
              version: a.version + 1,
            }
          : a,
      ),
    { attempts: 8, jitter: true },
  );

  return json({ ok: true });
};
