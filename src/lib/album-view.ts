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
}

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

/** Lees het share-token uit de URL-hash (#tok=…). */
export function tokenFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return params.get('tok');
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
