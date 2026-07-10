// /api/auth/* — staff-authenticatie.
//
// v1: wachtwoord-modus (brief §3b). De SSO-modus (AUTH_MODE=sso) is bewust een
// seam: de route bestaat maar geeft 501 tot de SharePoint-migratie (brief §14).
//
// Ondersteunt:
//   POST /api/auth/login   { username, password }  → sessiecookie
//   POST /api/auth/logout                          → cookie wissen

import type { Env } from '../env';
import type { AuthData } from '../lib/auth';
import { isAdminEmail, readAdmins, readTeachers } from '../lib/auth';
import { verifyPassword } from '../lib/crypto';
import { clearFails, isLocked, recordFail } from '../lib/lockout';
import { error, json } from '../lib/respond';
import { clearCookieHeader, sessionCookieHeader, signSession } from '../lib/session';
import { getStorage } from '../storage';

// Generieke faalmelding — onthult niet of de gebruikersnaam bestaat (anti-enumeratie).
const LOGIN_FAILED = 'Gebruikersnaam of wachtwoord onjuist.';

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const segment = lastSegment(ctx.request.url);

  if (segment === 'logout') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookieHeader() });
  }
  if (segment !== 'login') {
    return error('Onbekende auth-route.', 404);
  }

  // SSO-seam: niet actief in v1.
  if (ctx.env.AUTH_MODE !== 'password') {
    return error('SSO-aanmelding is niet beschikbaar in deze versie.', 501);
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return error('Ongeldige aanvraag.', 400);
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return error('Vul gebruikersnaam en wachtwoord in.', 400);

  const storage = getStorage(ctx.env);
  const now = Date.now();

  // Brute-force-rem vóór elke wachtwoordcontrole.
  const lock = await isLocked(storage, username, now);
  if (lock.locked) {
    const minutes = Math.ceil((lock.until - now) / 60000);
    return error(`Te veel pogingen. Probeer opnieuw over ${minutes} min.`, 429);
  }

  const teachers = await readTeachers(storage);
  const record = teachers[username];

  // Onbekende gebruiker of nog geen wachtwoord gezet → zelfde generieke fout,
  // maar wel als mislukte poging tellen (rem geldt ook voor onbekende namen).
  if (!record || !record.pass) {
    await recordFail(storage, username, now);
    return error(LOGIN_FAILED, 401);
  }

  const ok = await verifyPassword(password, record.pass);
  if (!ok) {
    await recordFail(storage, username, now);
    return error(LOGIN_FAILED, 401);
  }

  // Succes: rem resetten, sessie ondertekenen.
  await clearFails(storage, username);
  const nowSec = Math.floor(now / 1000);
  const cookie = await signSession(
    { username, email: record.email },
    ctx.env.SESSION_SECRET,
    nowSec,
  );

  const admins = await readAdmins(storage);
  const role = isAdminEmail(record.email, ctx.env, admins) ? 'admin' : 'contributor';

  return json(
    { ok: true, user: { username, email: record.email, role, classes: record.classes } },
    200,
    { 'set-cookie': sessionCookieHeader(cookie) },
  );
};

function lastSegment(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/, '');
  return path.slice(path.lastIndexOf('/') + 1);
}
