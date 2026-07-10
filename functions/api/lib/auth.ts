// Server-side identiteit & rolresolutie (brief §3).
//
// Rollen worden bij ELKE request vers opgelost uit config/admins.json +
// config/teachers.json — niet in de cookie gebakken — zodat het toevoegen of
// verwijderen van een admin meteen effect heeft zonder herlogin.

import type { Env } from '../env';
import type { StorageAdapter } from '../storage';
import type { SessionPayload } from './session';

export const TEACHERS_PATH = 'config/teachers.json';
export const ADMINS_PATH = 'config/admins.json';

/** Eén leerkracht-record in config/teachers.json, gesleuteld op gebruikersnaam. */
export interface TeacherRecord {
  email: string;
  classes: string[];
  /** PBKDF2-hash; leeg = nog geen wachtwoord gezet (kan niet inloggen). */
  pass: string;
}
export type TeachersFile = Record<string, TeacherRecord>;

export type Role = 'admin' | 'contributor';

export interface AuthUser {
  username: string;
  email: string;
  role: Role;
  /** Toegewezen klassen (contributor). Admins zien alles, ongeacht deze lijst. */
  classes: string[];
  bypassUntil?: number;
}

/** Data die _middleware.ts aan de request-context hangt.
 *  Index-signatuur omdat Pages Functions het Data-type als Record vereist. */
export interface AuthData extends Record<string, unknown> {
  user: AuthUser | null;
}

export async function readTeachers(storage: StorageAdapter): Promise<TeachersFile> {
  const res = await storage.readJson(TEACHERS_PATH);
  return res ? (res.data as TeachersFile) : {};
}

export async function readAdmins(storage: StorageAdapter): Promise<string[]> {
  const res = await storage.readJson(ADMINS_PATH);
  return res ? (res.data as string[]) : [];
}

/** Is dit e-mailadres een admin? (bootstrap-env OF admins.json — brief §3). */
export function isAdminEmail(email: string, env: Env, admins: string[]): boolean {
  const target = email.toLowerCase();
  if (env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase() === target) return true;
  return admins.some((a) => a.toLowerCase() === target);
}

/**
 * Zet een geverifieerde sessie om naar een AuthUser met verse rol/klassen.
 * null als de gebruiker intussen uit teachers.json verdween.
 */
export async function resolveAuthUser(
  payload: SessionPayload,
  env: Env,
  storage: StorageAdapter,
): Promise<AuthUser | null> {
  const [teachers, admins] = await Promise.all([readTeachers(storage), readAdmins(storage)]);
  const record = teachers[payload.username];
  if (!record) return null;

  const admin = isAdminEmail(record.email, env, admins);
  return {
    username: payload.username,
    email: record.email,
    role: admin ? 'admin' : 'contributor',
    classes: record.classes,
    ...(payload.bypassUntil !== undefined ? { bypassUntil: payload.bypassUntil } : {}),
  };
}

/** Mag deze gebruiker in deze klas werken? Admin altijd; contributor als toegewezen. */
export function canAccessClass(user: AuthUser, classId: string): boolean {
  return user.role === 'admin' || user.classes.includes(classId);
}
