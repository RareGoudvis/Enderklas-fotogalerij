// Route-guards. Elke guard geeft óf de AuthUser terug, óf een klaar-om-te-
// -returnen Response (401/403). Gebruik in een route:
//
//   const gate = requireUser(ctx.data);
//   if (gate instanceof Response) return gate;
//   const user = gate; // getypeerd als AuthUser

import type { AuthData, AuthUser } from './auth';
import { canAccessClass } from './auth';
import { forbidden, unauthorized } from './respond';

export function requireUser(data: AuthData): AuthUser | Response {
  if (!data.user) return unauthorized();
  return data.user;
}

export function requireAdmin(data: AuthData): AuthUser | Response {
  const user = requireUser(data);
  if (user instanceof Response) return user;
  if (user.role !== 'admin') return forbidden();
  return user;
}

/** Vereist dat de aangemelde gebruiker in de gegeven klas mag werken. */
export function requireClassAccess(data: AuthData, classId: string): AuthUser | Response {
  const user = requireUser(data);
  if (user instanceof Response) return user;
  if (!canAccessClass(user, classId)) return forbidden();
  return user;
}
