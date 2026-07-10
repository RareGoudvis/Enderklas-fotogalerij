// Gast-toegang: gedeelde autorisatie voor album-gescopede upload-zonder-account.
//
// Twee soorten tokens kunnen een album ontsluiten:
//  - ouder-viewtoken  (verifyToken)      → enkel bekijken; check tokenVersion.
//  - gast-token        (verifyGuestToken) → bekijken + uploaden; check guestVersion + exp.
// De kijk-endpoints aanvaarden beide; de upload-endpoints aanvaarden een sessie
// (albumbeheerder) óf een gast-token. Gasten kunnen NIET verwijderen.

import type { Env } from '../env';
import type { StorageAdapter } from '../storage';
import { verifyGuestToken, verifyToken } from '../tokens';
import type { Album } from './album';
import { canManageAlbum, findAlbum, guestVersionOf } from './album';
import type { AuthData, AuthUser } from './auth';
import { forbidden, unauthorized } from './respond';

export type TokenKind = 'view' | 'guest';

export interface ParsedAlbumToken {
  albumId: string;
  kind: TokenKind;
  tokenVersion?: number; // bij kind==='view'
  guestVersion?: number; // bij kind==='guest'
}

/** Lees een Bearer-token uit de Authorization-header. */
export function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

/**
 * Parse een token als ouder-view- óf gast-token (probeer view eerst). Geeft de
 * albumId + soort terug, of null. De aanroeper checkt daarna met
 * tokenMatchesAlbum() of de versie nog klopt (revocatie).
 */
export async function resolveAlbumToken(
  tok: string,
  secret: string,
  now: number,
): Promise<ParsedAlbumToken | null> {
  const view = await verifyToken(tok, secret);
  if (view) return { albumId: view.albumId, kind: 'view', tokenVersion: view.tokenVersion };

  const guest = await verifyGuestToken(tok, secret, now);
  if (guest) return { albumId: guest.albumId, kind: 'guest', guestVersion: guest.guestVersion };

  return null;
}

/** Klopt het geparste token nog met het album (juiste versie, niet ingetrokken)? */
export function tokenMatchesAlbum(parsed: ParsedAlbumToken, album: Album): boolean {
  if (parsed.albumId !== album.id) return false;
  if (parsed.kind === 'view') return album.tokenVersion === parsed.tokenVersion;
  return guestVersionOf(album) === parsed.guestVersion;
}

/**
 * Autoriseer een upload/registratie op dit album. Sessie met beheerrecht →
 * de AuthUser; geldig gast-token → 'guest'; anders een klaar Response (401/403).
 */
export async function authorizeUpload(
  ctx: { request: Request; env: Env; data: AuthData },
  album: Album,
): Promise<AuthUser | 'guest' | Response> {
  const user = ctx.data.user;
  if (user && canManageAlbum(user, album)) return user;

  const tok = bearerToken(ctx.request);
  if (tok) {
    const guest = await verifyGuestToken(tok, ctx.env.SHARE_SECRET, Date.now());
    if (guest && guest.albumId === album.id && guest.guestVersion === guestVersionOf(album)) {
      return 'guest';
    }
  }

  // Aangemeld maar geen recht → 403; anoniem zonder geldig token → 401.
  return user ? forbidden() : unauthorized();
}

/**
 * Is er een geldig (niet-vervallen, niet-ingetrokken) gast-token aanwezig?
 * Gebruikt om niet-album-gebonden leesjes (bv. storage-status → preset) voor de
 * gast-uploadpagina toe te staan zonder sessie.
 */
export async function validGuestToken(
  request: Request,
  env: Env,
  storage: StorageAdapter,
): Promise<boolean> {
  const tok = bearerToken(request);
  if (!tok) return false;
  const g = await verifyGuestToken(tok, env.SHARE_SECRET, Date.now());
  if (!g) return false;
  const found = await findAlbum(storage, g.albumId);
  return !!found && guestVersionOf(found.album) === g.guestVersion;
}
