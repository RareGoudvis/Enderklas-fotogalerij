// POST /api/albums/:id/revoke — sharelink intrekken (brief §7).
//
// Bump tokenVersion (alle oude links sterven meteen) én version (cache-bust).
// Geeft een nieuw token terug dat de beheerder/leerkracht kan kopiëren.

import type { Env } from '../../env';
import { canManageAlbum, findAlbum, mutateManifest } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { requireUser } from '../../lib/guard';
import { forbidden, json, notFound } from '../../lib/respond';
import { getStorage } from '../../storage';
import { signToken } from '../../tokens';

export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (!canManageAlbum(user, found.album)) return forbidden();

  let newTokenVersion = found.album.tokenVersion + 1;
  await mutateManifest(storage, found.homeClassId, (albums) =>
    albums.map((a) => {
      if (a.id !== albumId) return a;
      newTokenVersion = a.tokenVersion + 1; // op basis van de verse lezing
      return { ...a, tokenVersion: newTokenVersion, version: a.version + 1 };
    }),
  );

  const token = await signToken(albumId, newTokenVersion, ctx.env.SHARE_SECRET);
  return json({ ok: true, token, tokenVersion: newTokenVersion });
};
