// POST /api/admin/bypass — arm de Noodupload-bypass (brief §6). Admin-only.
// Voegt een kortlevende bypassUntil-claim (60 min) toe aan de sessiecookie. De
// upload-endpoint honoreert die enkel voor admins. Self-disarming op vervaltijd
// of bij uitloggen; nooit persistent opgeslagen. Contributors kunnen dit nooit.

import type { Env } from '../env';
import type { AuthData } from '../lib/auth';
import { requireAdmin } from '../lib/guard';
import { json } from '../lib/respond';
import { sessionCookieHeader, signSession } from '../lib/session';

const BYPASS_MS = 60 * 60 * 1000; // 60 minuten

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;
  const admin = gate;

  const bypassUntil = Date.now() + BYPASS_MS;
  const nowSec = Math.floor(Date.now() / 1000);
  const cookie = await signSession(
    { username: admin.username, email: admin.email, bypassUntil },
    ctx.env.SESSION_SECRET,
    nowSec,
  );

  return json({ ok: true, bypassUntil }, 200, { 'set-cookie': sessionCookieHeader(cookie) });
};
