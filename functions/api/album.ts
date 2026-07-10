// GET /api/album?tok=… — publieke albumweergave voor ouders (brief §7/§8).
// Verifieert het share-token, checkt tokenVersion (revocatie), en geeft de live
// medialijst terug met token-gated beeld-URL's.
//
// Caching (brief §8): "hot" album (recent geüpload) → max-age=10 zodat ouders
// foto's zien verschijnen; "settled" → langer. We versie-busten de BEELD-URL's
// met &v=<version>. De listing zelf cappen we op 1 uur i.p.v. 24 uur: op R2 zijn
// list-reads goedkoop, en zo is een consent-verwijdering gegarandeerd binnen een
// uur uit de listing weg — dezelfde grens als de beeld-binaries (GDPR, brief §8).

import type { Env } from './env';
import { findAlbum } from './lib/album';
import { resolveAlbumToken, tokenMatchesAlbum } from './lib/guest';
import { listPhotoIds } from './lib/media';
import { error, json } from './lib/respond';
import { getStorage } from './storage';
import { signToken } from './tokens';

const TWO_MIN = 2 * 60 * 1000;
const HOT = 'public, max-age=10';
const SETTLED = 'public, max-age=3600';

function extractToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return new URL(request.url).searchParams.get('tok');
}

export const onRequestGet: PagesFunction<Env, string, Record<string, unknown>> = async (ctx) => {
  const tok = extractToken(ctx.request);
  if (!tok) return error('Geen toegangstoken.', 401);

  // Aanvaardt zowel de ouder-viewtoken als een gast-token (bekijken + uploaden).
  const parsed = await resolveAlbumToken(tok, ctx.env.SHARE_SECRET, Date.now());
  if (!parsed) return error('Ongeldige link.', 401);

  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, parsed.albumId);
  if (!found) return error('Album niet gevonden.', 404);
  // Revocatie: de juiste versie moet nog matchen (tokenVersion / guestVersion).
  if (!tokenMatchesAlbum(parsed, found.album)) {
    return error('Deze link is niet meer geldig.', 401);
  }
  const canUpload = parsed.kind === 'guest'; // gast mag ook uploaden

  const { album } = found;
  const ids = await listPhotoIds(ctx.env.BUCKET, album.folderId);

  // BEELD-URL's dragen enkel een KIJK-token. Bij toegang via een gast-token
  // (dat óók upload toestaat) tekenen we hier een verse view-token, zodat het
  // krachtigere gast-token nooit in een <img>-URL / browsergeschiedenis belandt.
  // Het uploaden zelf gebruikt het gast-token via de Authorization-header.
  const imgTok =
    parsed.kind === 'guest'
      ? await signToken(album.id, album.tokenVersion, ctx.env.SHARE_SECRET)
      : tok;
  const encTok = encodeURIComponent(imgTok);
  const items = ids.map((id) => ({
    id,
    thumbnailUrl: `/api/img/${album.id}/thumbs/${id}.webp?tok=${encTok}&v=${album.version}`,
    fullUrl: `/api/img/${album.id}/${id}.webp?tok=${encTok}&v=${album.version}`,
    downloadUrl: `/api/img/${album.id}/${id}.webp?tok=${encTok}&v=${album.version}&dl=1`,
  }));

  const lastUpload = album.lastUploadAt ? Date.parse(album.lastUploadAt) : 0;
  const hot = Date.now() - lastUpload < TWO_MIN;

  return json(
    {
      album: {
        id: album.id,
        name: album.name,
        version: album.version,
        lastUploadAt: album.lastUploadAt,
        count: items.length,
        canUpload, // true bij een geldig gast-token → frontend toont de upload-knop
      },
      items,
    },
    200,
    { 'cache-control': hot ? HOT : SETTLED },
  );
};
