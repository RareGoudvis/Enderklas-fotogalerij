// Album-API-client + gedeelde types (frontend).

import { RETENTION_NOTICE } from '../config/constants';
import { api } from './api';

export interface Album {
  id: string;
  name: string;
  classes: string[];
  createdAt: string;
  createdBy: string;
  folderId: string;
  shareLinkUrl: string | null;
  lastUploadAt: string | null;
  version: number;
  tokenVersion: number;
  backend: string;
  /** Vers share-token, meegeleverd door de list-endpoint (staff-gemak). */
  token?: string;
}

export function listAlbums(classId: string): Promise<{ albums: Album[] }> {
  return api.get(`/api/classes/${classId}/albums`);
}

export function createAlbum(
  homeClassId: string,
  name: string,
  classes: string[],
): Promise<{ album: Album; token: string }> {
  return api.post(`/api/classes/${homeClassId}/albums`, { name, classes });
}

export function deleteAlbum(albumId: string): Promise<{ ok: true }> {
  return api.del(`/api/albums/${albumId}`);
}

export function revokeAlbum(albumId: string): Promise<{ ok: true; token: string }> {
  return api.post(`/api/albums/${albumId}/revoke`);
}

/** Bouw de volledige, deelbare ouderlink (token in de URL-hash, brief §7). */
export function buildShareLink(token: string): string {
  return `${window.location.origin}/album#tok=${token}`;
}

/** Kopieerbare deeltekst — met de retentieregel eraan geplakt (brief §7). */
export function buildShareText(albumName: string, token: string): string {
  return `Foto's "${albumName}": ${buildShareLink(token)}\n\n${RETENTION_NOTICE}`;
}
