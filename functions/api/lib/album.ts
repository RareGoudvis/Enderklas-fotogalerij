// Album-datamodel + manifest-helpers (brief §5).
//
// Geen database: albums leven als entries in per-klas manifest-JSONs in R2,
// op pad manifests/<class_id>.json. Een album staat in precies ÉÉN home-manifest
// (de klas waarin het is aangemaakt) maar draagt een classes[]-tagreeks; de
// listing leest ALLE manifests en filtert op overlap. Nooit dupliceren.

import { CLASS_IDS } from '../../../src/config/classes';
import { ConflictError, type StorageAdapter } from '../storage';
import type { AuthUser } from './auth';

/** Eén album-entry in een manifest. Zie brief §5 voor de veldbetekenis. */
export interface Album {
  id: string; // 8-char nanoid
  name: string;
  classes: string[]; // tags; bevat altijd de home-klas
  createdAt: string; // ISO8601
  createdBy: string; // e-mail
  folderId: string; // R2 key-prefix van de albummap
  shareLinkUrl: string | null; // null op R2 (client-zip i.p.v. server-zip)
  lastUploadAt: string | null;
  version: number; // cache-bust-teller (upload/delete bumpt dit)
  tokenVersion: number; // revoke bumpt dit → oude sharelinks sterven
  /**
   * "Dode" backend-marker (brief §5) — bewust NIET verwijderen. Wordt in v1
   * nergens gelezen; bestaat voor de latere storage-migratie als idempotentie-
   * marker en mixed-backend-routing.
   */
  backend: string;
}

interface ManifestFile {
  albums: Album[];
}

export function manifestPath(classId: string): string {
  return `manifests/${classId}.json`;
}

/** Lees één klas-manifest (+ ETag). Lege manifest als het nog niet bestaat. */
export async function readManifest(
  storage: StorageAdapter,
  classId: string,
): Promise<{ albums: Album[]; etag?: string }> {
  const res = await storage.readJson(manifestPath(classId));
  if (!res) return { albums: [] };
  const data = res.data as ManifestFile;
  return { albums: Array.isArray(data.albums) ? data.albums : [], etag: res.etag };
}

/**
 * Muteer een klas-manifest ETag-veilig met retry-once (brief §5). De callback
 * krijgt de huidige albumlijst en geeft de nieuwe terug.
 */
export async function mutateManifest(
  storage: StorageAdapter,
  classId: string,
  fn: (albums: Album[]) => Album[],
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { albums, etag } = await readManifest(storage, classId);
    const next: ManifestFile = { albums: fn(albums) };
    try {
      await storage.writeJson(manifestPath(classId), next, etag);
      return;
    } catch (e) {
      if (e instanceof ConflictError && attempt === 0) continue; // her-lees en retry
      throw e;
    }
  }
}

/**
 * Aggregeer albums over ALLE manifests. Elk album staat in precies één home-
 * manifest, dus dedupe is niet nodig — we lezen simpelweg alles samen.
 */
export async function readAllAlbums(storage: StorageAdapter): Promise<Album[]> {
  const results = await Promise.all(
    CLASS_IDS.map((id) => readManifest(storage, id).then((m) => m.albums)),
  );
  return results.flat();
}

/** Vind een album op id over alle manifests; geeft ook de home-klas terug. */
export async function findAlbum(
  storage: StorageAdapter,
  albumId: string,
): Promise<{ album: Album; homeClassId: string } | null> {
  for (const classId of CLASS_IDS) {
    const { albums } = await readManifest(storage, classId);
    const album = albums.find((a) => a.id === albumId);
    if (album) return { album, homeClassId: classId };
  }
  return null;
}

/** Snijdt een album met de klassen waartoe de gebruiker toegang heeft? */
export function albumIntersects(album: Album, allowedClasses: string[]): boolean {
  return album.classes.some((c) => allowedClasses.includes(c));
}

/**
 * Mag deze gebruiker dit album beheren (uploaden/verwijderen/herroepen)?
 * Admin altijd; een contributor als hij één van de getagde klassen heeft —
 * elke getagde leerkracht krijgt bewust ook verwijderrechten (GDPR consent-fix,
 * brief §5).
 */
export function canManageAlbum(user: AuthUser, album: Album): boolean {
  return user.role === 'admin' || album.classes.some((c) => user.classes.includes(c));
}
