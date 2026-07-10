// GET /api/admin/export/:classId — leveren wat de browser nodig heeft om per
// klas een streaming-zip te bouwen (brief §9, Export-tab). Geeft per album de
// token-gated download-URL's (samengestelde bestandsnaam via ?dl=1). De browser
// zipt sequentieel met client-zip (flat geheugen).

import { isValidClassId } from '../../../../src/config/classes';
import type { Env } from '../../env';
import { readAllAlbums } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { requireAdmin } from '../../lib/guard';
import { listPhotoIds } from '../../lib/media';
import { error, json } from '../../lib/respond';
import { getStorage } from '../../storage';
import { signToken } from '../../tokens';

export const onRequestGet: PagesFunction<Env, 'classId', AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const classId = ctx.params.classId as string;
  if (!isValidClassId(classId)) return error('Onbekende klas.', 404);

  const storage = getStorage(ctx.env);
  const albums = (await readAllAlbums(storage)).filter((a) => a.classes.includes(classId));

  const out = await Promise.all(
    albums.map(async (album) => {
      const tok = await signToken(album.id, album.tokenVersion, ctx.env.SHARE_SECRET);
      const encTok = encodeURIComponent(tok);
      const ids = await listPhotoIds(ctx.env.BUCKET, album.folderId);
      return {
        name: album.name,
        items: ids.map((id) => ({
          id,
          url: `/api/img/${album.id}/${id}.webp?tok=${encTok}&dl=1`,
        })),
      };
    }),
  );

  // Lege albums overslaan in de export (brief §9).
  return json({ albums: out.filter((a) => a.items.length > 0) });
};
