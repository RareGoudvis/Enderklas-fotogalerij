// Album-API-client + gedeelde types (frontend).

import { RETENTION_NOTICE } from '../config/constants';
import type { PresetName } from '../config/compression';
import { ApiError, api } from './api';

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

export interface StorageStatus {
  usedBytes: number;
  usedGb: number;
  preset: PresetName;
  pinned: PresetName | null;
  capGb: number;
  capReached: boolean;
}

export function getStorageStatus(): Promise<StorageStatus> {
  return api.get('/api/storage-status');
}

/**
 * Upload één gecomprimeerd bestand (main + thumb) via multipart POST.
 * Gebruikt XHR i.p.v. fetch om echte upload-voortgang per bestand te melden
 * (fetch heeft geen upload-progress-event).
 */
export function uploadPhoto(
  albumId: string,
  main: Blob,
  thumb: Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('main', main, 'main.webp');
    fd.append('thumb', thumb, 'thumb.webp');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/albums/${albumId}/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new ApiError(xhr.status, 'Ongeldig serverantwoord.'));
        }
      } else {
        reject(new ApiError(xhr.status, xhr.responseText || xhr.statusText));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Netwerkfout tijdens upload.'));
    xhr.send(fd);
  });
}

/** Registreer een (batch) upload → manifest bump. Gedebouncet door de caller. */
export function registerUpload(albumId: string): Promise<{ ok: true }> {
  return api.post(`/api/albums/${albumId}/register`);
}

/** Bouw de volledige, deelbare ouderlink (token in de URL-hash, brief §7). */
export function buildShareLink(token: string): string {
  return `${window.location.origin}/album#tok=${token}`;
}

/** Kopieerbare deeltekst — met de retentieregel eraan geplakt (brief §7). */
export function buildShareText(albumName: string, token: string): string {
  return `Foto's "${albumName}": ${buildShareLink(token)}\n\n${RETENTION_NOTICE}`;
}
