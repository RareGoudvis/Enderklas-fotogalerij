// GET /api/img/:albumId/*path?tok=…[&dl=1] — token-gated beeld-serving (R2-setup
// §4). Serveert zowel hoofdbeeld (<uuid>.webp) als thumbnail (thumbs/<uuid>.webp).
//
// GDPR (brief §8): beeld- én thumbnail-binaries cappen op max-age=3600 (1 uur).
// Het 24u-schema geldt enkel voor de listing; een voor consent verwijderde foto
// verdwijnt binnen seconden uit de galerij (version-bump) en binnen een uur uit
// elke direct gecachte URL.

import type { Env } from '../../env';
import { findAlbum } from '../../lib/album';
import { composedFilename } from '../../lib/filename';
import { error, notFound } from '../../lib/respond';
import { getStorage } from '../../storage';
import { verifyToken } from '../../tokens';

const BINARY_CACHE = 'public, max-age=3600'; // 1 uur (GDPR-cap)

export const onRequestGet: PagesFunction<
  Env,
  'albumId' | 'path',
  Record<string, unknown>
> = async (ctx) => {
  const albumId = ctx.params.albumId as string;
  const rawPath = ctx.params.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '');

  // Padbeveiliging: geen traversal, enkel .webp.
  if (!path || path.includes('..') || !path.endsWith('.webp')) return notFound();

  const url = new URL(ctx.request.url);
  const tok = url.searchParams.get('tok');
  if (!tok) return error('Geen toegangstoken.', 401);

  const parsed = await verifyToken(tok, ctx.env.SHARE_SECRET);
  if (!parsed || parsed.albumId !== albumId) return error('Ongeldige link.', 401);

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();
  if (found.album.tokenVersion !== parsed.tokenVersion) {
    return error('Deze link is niet meer geldig.', 401);
  }

  const key = `${found.album.folderId}/${path}`;
  const obj = await ctx.env.BUCKET.get(key);
  if (!obj) return notFound();

  const headers = new Headers({
    'content-type': 'image/webp',
    'cache-control': BINARY_CACHE,
  });

  // Downloadmodus: samengestelde bestandsnaam (brief §5).
  if (url.searchParams.get('dl') === '1') {
    const photoId = path.replace(/^thumbs\//, '').replace(/\.webp$/, '');
    const filename = composedFilename(found.album.name, photoId);
    headers.set('content-disposition', `attachment; filename="${filename}"`);
  }

  return new Response(obj.body, { headers });
};
