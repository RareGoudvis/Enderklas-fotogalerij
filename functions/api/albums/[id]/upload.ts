// POST /api/albums/:id/upload — één gecomprimeerd bestand (main + optionele
// thumb) opslaan in R2 (R2-setup.md §3). De browser comprimeert; de server
// streamt enkel naar de bucket. Bumpt het manifest NIET — dat doet de
// (gedebouncede) register-endpoint.
//
// Billing-failsafe (brief §6): boven STORAGE_HARD_CAP_GB weigert dit endpoint
// nieuwe uploads. Enkel een admin met een actieve Noodupload-bypass in zijn
// sessie mag er dan nog door; contributors nooit.

import type { Env } from '../../env';
import { findAlbum } from '../../lib/album';
import type { AuthData } from '../../lib/auth';
import { authorizeUpload } from '../../lib/guest';
import { error, json, notFound } from '../../lib/respond';
import { bytesToGb, computeUsedBytes } from '../../lib/usage';
import { getStorage } from '../../storage';

export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async (ctx) => {
  const albumId = ctx.params.id as string;

  // Album ophalen via de storage-adapter (findAlbum leest manifests).
  const storage = getStorage(ctx.env);
  const found = await findAlbum(storage, albumId);
  if (!found) return notFound();

  // Sessie met beheerrecht óf een geldig gast-token. Gasten mogen uploaden.
  const auth = await authorizeUpload(ctx, found.album);
  if (auth instanceof Response) return auth;

  // Billing-failsafe. De Noodupload-bypass geldt enkel voor een admin-SESSIE
  // met een actieve claim, nooit voor gasten of contributors.
  const capGb = Number(ctx.env.STORAGE_HARD_CAP_GB) || 9.8;
  const usedGb = bytesToGb(await computeUsedBytes(ctx.env.BUCKET));
  if (usedGb >= capGb) {
    const hasBypass =
      auth !== 'guest' &&
      auth.role === 'admin' &&
      typeof auth.bypassUntil === 'number' &&
      auth.bypassUntil > Date.now();
    if (!hasBypass) {
      return error('Opslag vol — verwittig de beheerder.', 507);
    }
  }

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return error('Ongeldige upload.', 400);
  }
  // Runtime geeft Blob/File terug voor bestandsvelden; de types van workers-types
  // zijn hier smaller dan de runtime, dus casten we naar de bredere unie.
  const main = form.get('main') as unknown as Blob | string | null;
  const thumb = form.get('thumb') as unknown as Blob | string | null;
  if (!main || typeof main === 'string') return error('Geen afbeelding ontvangen.', 400);

  // uuid-bestandsnaam; originele camera-namen worden bewust niet bewaard (brief §5).
  const uuid = crypto.randomUUID();
  const mainKey = `${found.album.folderId}/${uuid}.webp`;
  const thumbKey = `${found.album.folderId}/thumbs/${uuid}.webp`;

  // Rechtstreeks naar de R2-binding streamen (R2-specifiek upload-pad).
  await ctx.env.BUCKET.put(mainKey, main.stream(), {
    httpMetadata: { contentType: 'image/webp' },
  });
  if (thumb && typeof thumb !== 'string') {
    await ctx.env.BUCKET.put(thumbKey, thumb.stream(), {
      httpMetadata: { contentType: 'image/webp' },
    });
  }

  return json({ ok: true, id: uuid }, 201);
};
