// Publieke albumweergave-client (ouderzijde). Token komt uit de URL-hash
// (#tok=…) zodat het nooit in serverlogs of Referer-headers belandt (brief §7).

import { SCHOOLJAAR } from '../config/constants';
import { ApiError } from './api';

export interface AlbumMeta {
  id: string;
  name: string;
  version: number;
  lastUploadAt: string | null;
  count: number;
  /** True bij een geldig gast-token → de gast mag ook uploaden. */
  canUpload?: boolean;
}

export type TokenKind = 'view' | 'guest';

export interface MediaItem {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string;
}

export interface AlbumViewData {
  album: AlbumMeta;
  items: MediaItem[];
}

/**
 * Lees het token uit de URL-hash. `#tok=…` = ouder-viewlink, `#gtok=…` =
 * gast-uploadlink (bekijken + toevoegen). Beide gaan als ?tok= naar de server,
 * die zelf het soort bepaalt; de `kind` stuurt enkel wat de UI toont.
 */
export function tokenFromHash(): { token: string; kind: TokenKind } | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const guest = params.get('gtok');
  if (guest) return { token: guest, kind: 'guest' };
  const view = params.get('tok');
  if (view) return { token: view, kind: 'view' };
  return null;
}

export async function fetchAlbum(token: string): Promise<AlbumViewData> {
  const res = await fetch(`/api/album?tok=${encodeURIComponent(token)}`);
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText);
  return res.json();
}

/** Slug van een albumtitel (spiegelt de serverkant, brief §5). */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'album'
  );
}

/** [schooljaar]-[album-slug]-[photoId].webp */
export function composedFilename(albumName: string, photoId: string): string {
  return `${SCHOOLJAAR}-${slugify(albumName)}-${photoId}.webp`;
}

export function zipFilename(albumName: string): string {
  return `${SCHOOLJAAR}-${slugify(albumName)}.zip`;
}
