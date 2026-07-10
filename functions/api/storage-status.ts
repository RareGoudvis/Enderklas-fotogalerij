// GET /api/storage-status — bucketgebruik + actieve compressie-preset
// (R2-setup.md §3). De dropzone haalt dit op vóór een batch. Vereist login
// (staff), zodat gebruikscijfers niet publiek zijn.

import { presetForUsage } from '../../src/config/compression';
import type { Env } from './env';
import type { AuthData } from './lib/auth';
import { requireUser } from './lib/guard';
import { json } from './lib/respond';
import { readSettings } from './lib/settings';
import { bytesToGb, computeUsedBytes } from './lib/usage';
import { getStorage } from './storage';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;

  const usedBytes = await computeUsedBytes(ctx.env.BUCKET);
  const usedGb = bytesToGb(usedBytes);
  const settings = await readSettings(getStorage(ctx.env));
  const preset = settings.pinnedPreset ?? presetForUsage(usedGb);
  const capGb = Number(ctx.env.STORAGE_HARD_CAP_GB) || 9.8;

  return json({
    usedBytes,
    usedGb,
    preset,
    pinned: settings.pinnedPreset ?? null,
    capGb,
    capReached: usedGb >= capGb,
  });
};
