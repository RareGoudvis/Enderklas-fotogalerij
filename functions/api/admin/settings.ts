// GET/POST /api/admin/settings — vastgepinde compressie-preset (R2-setup.md §3).
// Overschrijft de auto-degradatie tot de admin hem weer op 'auto' zet.

import type { PresetName } from '../../../src/config/compression';
import { PRESETS } from '../../../src/config/compression';
import type { Env } from '../env';
import type { AuthData } from '../lib/auth';
import { mutateJson } from '../lib/configfile';
import { requireAdmin } from '../lib/guard';
import { error, json } from '../lib/respond';
import type { Settings } from '../lib/settings';
import { SETTINGS_PATH, readSettings } from '../lib/settings';
import { getStorage } from '../storage';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;
  const settings = await readSettings(getStorage(ctx.env));
  return json({ pinnedPreset: settings.pinnedPreset ?? null });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  let body: { pinnedPreset?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  const pinned = body.pinnedPreset;
  // null/leeg = terug naar auto; anders moet het een geldige preset zijn.
  if (pinned !== null && pinned !== '' && !(typeof pinned === 'string' && pinned in PRESETS)) {
    return error('Onbekende preset.', 400);
  }
  const value = pinned && typeof pinned === 'string' ? (pinned as PresetName) : undefined;

  const storage = getStorage(ctx.env);
  await mutateJson<Settings>(storage, SETTINGS_PATH, {}, (s) => {
    const next = { ...s };
    if (value) next.pinnedPreset = value;
    else delete next.pinnedPreset;
    return next;
  });
  return json({ ok: true, pinnedPreset: value ?? null });
};
