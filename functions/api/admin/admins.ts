// /api/admin/admins — beheer van config/admins.json (brief §9, Beheerders-tab).
// Elke admin mag admins toevoegen/verwijderen (geen hiërarchie op deze schaal).
// De bootstrap-admin (env) staat altijd in de lijst en is niet verwijderbaar.

import type { Env } from '../env';
import type { AuthData } from '../lib/auth';
import { ADMINS_PATH, readAdmins } from '../lib/auth';
import { mutateJson } from '../lib/configfile';
import { requireAdmin } from '../lib/guard';
import { error, json } from '../lib/respond';
import { getStorage } from '../storage';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const bootstrap = ctx.env.BOOTSTRAP_ADMIN_EMAIL;
  const admins = await readAdmins(getStorage(ctx.env));
  // Bootstrap altijd tonen (gemarkeerd, niet verwijderbaar), zonder duplicaat.
  const set = new Map<string, { email: string; bootstrap: boolean }>();
  set.set(bootstrap.toLowerCase(), { email: bootstrap, bootstrap: true });
  for (const a of admins) {
    if (!set.has(a.toLowerCase())) set.set(a.toLowerCase(), { email: a, bootstrap: false });
  }
  return json({ admins: [...set.values()] });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  let body: { email?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email.includes('@')) return error('Geef een geldig e-mailadres.', 400);

  const storage = getStorage(ctx.env);
  await mutateJson<string[]>(storage, ADMINS_PATH, [], (list) =>
    list.some((a) => a.toLowerCase() === email.toLowerCase()) ? list : [...list, email],
  );
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const email = new URL(ctx.request.url).searchParams.get('email') ?? '';
  if (!email) return error('Geen e-mailadres.', 400);
  // Bootstrap-admin is onverwijderbaar — voorkomt dat het platform verweesd raakt.
  if (email.toLowerCase() === ctx.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    return error('De hoofdbeheerder kan niet verwijderd worden.', 400);
  }

  const storage = getStorage(ctx.env);
  await mutateJson<string[]>(storage, ADMINS_PATH, [], (list) =>
    list.filter((a) => a.toLowerCase() !== email.toLowerCase()),
  );
  return json({ ok: true });
};
