// Pages Functions middleware — draait vóór elke /api/*-route.
//
// Verantwoordelijkheid: sessie parsen + rol oplossen en aan de context hangen
// (data.user). Blokkeert NIET zelf — elke route beslist of auth vereist is via
// de helpers in lib/guard.ts. Zo blijven publieke routes (health, login,
// parent-album) toegankelijk.

import type { Env } from './env';
import type { AuthData } from './lib/auth';
import { resolveAuthUser } from './lib/auth';
import { readSessionCookie, verifySession } from './lib/session';
import { error } from './lib/respond';
import { getStorage } from './storage';

export const onRequest: PagesFunction<Env, string, AuthData> = async (ctx) => {
  ctx.data.user = null;

  try {
    const cookie = readSessionCookie(ctx.request);
    if (cookie) {
      const nowSec = Math.floor(Date.now() / 1000);
      const payload = await verifySession(cookie, ctx.env.SESSION_SECRET, nowSec);
      if (payload) {
        const storage = getStorage(ctx.env);
        ctx.data.user = await resolveAuthUser(payload, ctx.env, storage);
      }
    }
  } catch {
    // Auth-resolutie mag een request nooit doen crashen; behandel als anoniem.
    ctx.data.user = null;
  }

  try {
    return await ctx.next();
  } catch (e) {
    // Vangnet: onverwachte fouten in routes → nette 500 i.p.v. lege response.
    return error(e instanceof Error ? e.message : 'Interne serverfout.', 500);
  }
};
