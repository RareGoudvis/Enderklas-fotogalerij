// POST /api/admin/passwords/clear — "Alle wachtwoorden wissen" (brief §3b/§9).
// Blankt elk wachtwoord-hash BEHALVE dat van de bootstrap-admin, zodat aan het
// begin van een schooljaar niemand kan inloggen tot de admin nieuwe zet. De
// admin-wachtwoorden bewaken de wipe-knop en zijn nooit vrijgesteld van sterk zijn.

import type { Env } from '../../env';
import type { AuthData, TeachersFile } from '../../lib/auth';
import { TEACHERS_PATH } from '../../lib/auth';
import { mutateJson } from '../../lib/configfile';
import { requireAdmin } from '../../lib/guard';
import { json } from '../../lib/respond';
import { getStorage } from '../../storage';

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const bootstrap = ctx.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const storage = getStorage(ctx.env);
  let cleared = 0;

  await mutateJson<TeachersFile>(storage, TEACHERS_PATH, {}, (data) => {
    const next: TeachersFile = {};
    for (const [username, r] of Object.entries(data)) {
      const isBootstrap = r.email.toLowerCase() === bootstrap;
      if (!isBootstrap && r.pass) cleared++;
      next[username] = { ...r, pass: isBootstrap ? r.pass : '' };
    }
    return next;
  });

  return json({ ok: true, cleared });
};
