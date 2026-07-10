// GET /api/me — identiteit, rol en toegewezen klassen van de aangemelde
// gebruiker (brief §4). De frontend gebruikt dit voor route-guards en om te
// beslissen wat te tonen. 401 als niet aangemeld.

import type { Env } from './env';
import type { AuthData } from './lib/auth';
import { requireUser } from './lib/guard';
import { json } from './lib/respond';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireUser(ctx.data);
  if (gate instanceof Response) return gate;
  const user = gate;

  return json({
    username: user.username,
    email: user.email,
    role: user.role,
    classes: user.classes,
  });
};
