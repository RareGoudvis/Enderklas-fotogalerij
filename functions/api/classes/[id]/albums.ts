// /api/classes/:id/albums — lijst (GET) en aanmaken (POST) van albums in een klas.
//
// :id is de home-klas. Een album leeft in precies dat manifest maar kan meerdere
// klassen taggen (brief §5). De listing aggregeert álle manifests en filtert op
// de gevraagde klas.

import { isValidClassId } from '../../../../src/config/classes';
import type { Env } from '../../env';
import type { Album } from '../../lib/album';
import { mutateManifest, readAllAlbums } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { requireClassAccess } from '../../lib/guard';
import { newAlbumId } from '../../lib/ids';
import { error, json } from '../../lib/respond';
import { getStorage } from '../../storage';
import { signToken } from '../../tokens';

// GET: albums getagd met deze klas, zichtbaar voor de aangemelde gebruiker.
export const onRequestGet: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const classId = ctx.params.id as string;
  if (!isValidClassId(classId)) return error('Onbekende klas.', 404);

  const gate = requireClassAccess(ctx.data, classId);
  if (gate instanceof Response) return gate;

  const storage = getStorage(ctx.env);
  const all = await readAllAlbums(storage);
  const filtered = all
    .filter((a) => a.classes.includes(classId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // nieuwste eerst

  // Voeg per album een vers share-token toe zodat de leerkracht meteen kan
  // (her)delen zonder het SHARE_SECRET te kennen.
  const albums = await Promise.all(
    filtered.map(async (a) => ({
      ...a,
      token: await signToken(a.id, a.tokenVersion, ctx.env.SHARE_SECRET),
    })),
  );

  return json({ albums });
};

// POST: nieuw album aanmaken in deze home-klas.
export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const homeClassId = ctx.params.id as string;
  if (!isValidClassId(homeClassId)) return error('Onbekende klas.', 404);

  const gate = requireClassAccess(ctx.data, homeClassId);
  if (gate instanceof Response) return gate;
  const user = gate;

  let body: { name?: unknown; classes?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return error('Geef het album een naam.', 400);

  // Tags: opgegeven klassen + altijd de home-klas. Een contributor mag elke
  // (geldige) klas taggen — taggen verleent toegang (brief §5).
  const requested = Array.isArray(body.classes)
    ? body.classes.filter((c): c is string => typeof c === 'string')
    : [];
  const classes = Array.from(new Set([homeClassId, ...requested]));
  const invalid = classes.filter((c) => !isValidClassId(c));
  if (invalid.length) return error(`Onbekende klas(sen): ${invalid.join(', ')}`, 400);

  const storage = getStorage(ctx.env);
  const id = newAlbumId();
  const { folderId } = await storage.createAlbumFolder(homeClassId, id);
  const now = new Date().toISOString();

  const album: Album = {
    id,
    name,
    classes,
    createdAt: now,
    createdBy: user.email,
    folderId,
    shareLinkUrl: null, // R2: geen server-zip-link (brief §5/R2-setup §4)
    lastUploadAt: null,
    version: 0,
    tokenVersion: 1,
    backend: ctx.env.STORAGE_BACKEND, // "dode" marker voor latere migratie (brief §5)
  };

  await mutateManifest(storage, homeClassId, (albums) => [...albums, album]);

  const token = await signToken(id, album.tokenVersion, ctx.env.SHARE_SECRET);
  return json({ album, token }, 201);
};
