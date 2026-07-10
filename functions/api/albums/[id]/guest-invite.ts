// POST /api/albums/:id/guest-invite — maak een gast-uploadlink (brief-uitbreiding).
//
// Album-gescoped, tijdsgebonden (zelf-vervallend) gast-token: laat een gast
// zonder account foto's toevoegen aan én dit album bekijken. Aan te maken door
// elke albumbeheerder (admin of getagde leerkracht). Intrekken via .../revoke.

import type { Env } from '../../env';
import { canManageAlbum, findAlbum, guestVersionOf } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { requireUser } from '../../lib/guard';
import { error, forbidden, json, notFound } from '../../lib/respond';
import { getStorage } from '../../storage';
import { signGuestToken } from '../../tokens';

const DAY_MS = 86_400_000;

export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  let body: { days?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  // Geldigheid in dagen, geklemd op 1..30 (default 14).
  const raw = Number(body.days);
  const days = Number.isFinite(raw) ? Math.min(30, Math.max(1, Math.round(raw))) : 14;

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (!canManageAlbum(user, found.album)) return forbidden();

  const expiresAt = Date.now() + days * DAY_MS;
  const token = await signGuestToken(
    albumId,
    guestVersionOf(found.album),
    expiresAt,
    ctx.env.SHARE_SECRET,
  );

  return json({ token, expiresAt, days });
};
