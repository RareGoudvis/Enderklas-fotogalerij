// POST /api/albums/:id/guest-invite/revoke — trek alle gast-uploadlinks in.
//
// Bumpt album.guestVersion → elk uitstaand gast-token wordt ongeldig. Los van
// tokenVersion, dus ouder-viewlinks blijven werken. Enkel albumbeheerders.

import type { Env } from '../../../env';
import { canManageAlbum, findAlbum, guestVersionOf, mutateManifest } from '../../../lib/album';
import type { AuthData } from '../../../lib/auth';
import { requireUser } from '../../../lib/guard';
import { forbidden, json, notFound } from '../../../lib/respond';
import { getStorage } from '../../../storage';

export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (!canManageAlbum(user, found.album)) return forbidden();

  let newGuestVersion = guestVersionOf(found.album) + 1;
  await mutateManifest(storage, found.homeClassId, (albums) =>
    albums.map((a) => {
      if (a.id !== albumId) return a;
      newGuestVersion = guestVersionOf(a) + 1; // op basis van de verse lezing
      return { ...a, guestVersion: newGuestVersion };
    }),
  );

  return json({ ok: true, guestVersion: newGuestVersion });
};
