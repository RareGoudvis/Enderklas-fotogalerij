// /api/admin/teachers — beheer van config/teachers.json (brief §9, Leerkrachten-tab).
// Admin-only. Wachtwoorden worden door de admin getypt en hier gehasht; hashes
// worden NOOIT teruggegeven (enkel of er een wachtwoord gezet is).

import { isValidClassId } from '../../../src/config/classes';
import type { Env } from '../env';
import type { AuthData, TeacherRecord, TeachersFile } from '../lib/auth';
import { TEACHERS_PATH, readTeachers } from '../lib/auth';
import { mutateJson } from '../lib/configfile';
import { hashPassword } from '../lib/crypto';
import { requireAdmin } from '../lib/guard';
import { error, json } from '../lib/respond';
import { getStorage } from '../storage';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  const teachers = await readTeachers(getStorage(ctx.env));
  // Hashes weglaten; enkel meedelen of er een wachtwoord gezet is.
  const list = Object.entries(teachers).map(([username, r]) => ({
    username,
    email: r.email,
    classes: r.classes,
    hasPassword: !!r.pass,
  }));
  return json({ teachers: list });
};

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;

  let body: { username?: unknown; email?: unknown; classes?: unknown; password?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const classes = Array.isArray(body.classes)
    ? body.classes.filter((c): c is string => typeof c === 'string')
    : [];
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-z]{2,12}$/.test(username)) return error('Gebruikersnaam: 2–12 kleine letters.', 400);
  if (!email.includes('@')) return error('Geef een geldig e-mailadres.', 400);
  const invalid = classes.filter((c) => !isValidClassId(c));
  if (invalid.length) return error(`Onbekende klas(sen): ${invalid.join(', ')}`, 400);

  const newPassHash = password ? await hashPassword(password) : null;
  const storage = getStorage(ctx.env);
  await mutateJson<TeachersFile>(storage, TEACHERS_PATH, {}, (data) => {
    const existing = data[username];
    const record: TeacherRecord = {
      email,
      classes,
      // Nieuw wachtwoord indien opgegeven, anders het bestaande behouden.
      pass: newPassHash ?? existing?.pass ?? '',
    };
    return { ...data, [username]: record };
  });

  return json({ ok: true, username });
};

export const onRequestDelete: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const gate = requireAdmin(ctx.data);
  if (gate instanceof Response) return gate;
  const admin = gate;

  const username = new URL(ctx.request.url).searchParams.get('username')?.toLowerCase() ?? '';
  if (!username) return error('Geen gebruikersnaam.', 400);
  // De bootstrap-admin kan niet zichzelf uit teachers verwijderen (zou login breken).
  if (username === admin.username && admin.email.toLowerCase() === ctx.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    return error('De hoofdbeheerder kan niet verwijderd worden.', 400);
  }

  const storage = getStorage(ctx.env);
  await mutateJson<TeachersFile>(storage, TEACHERS_PATH, {}, (data) => {
    const next = { ...data };
    delete next[username];
    return next;
  });
  return json({ ok: true });
};
