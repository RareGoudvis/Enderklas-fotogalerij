// Storage-factory: kiest de adapter op basis van STORAGE_BACKEND.
//
// Dit is het ENIGE punt waar de backend gekozen wordt. Routes praten nooit
// rechtstreeks met R2 of Graph — ze vragen getStorage(env) en gebruiken de
// StorageAdapter-interface (brief §2).

import type { Env } from '../env';
import { R2Storage } from './r2';
import { SharePointStorage } from './sharepoint';
import type { StorageAdapter } from './types';

export function getStorage(env: Env): StorageAdapter {
  switch (env.STORAGE_BACKEND) {
    case 'r2':
      return new R2Storage(env.BUCKET);
    case 'sharepoint':
      // Stub in v1 — zie sharepoint.ts. Wordt luid falen bij gebruik.
      return new SharePointStorage();
    default:
      throw new Error(`Onbekende STORAGE_BACKEND: ${String(env.STORAGE_BACKEND)}`);
  }
}

export { ConflictError } from './types';
export type { MediaItem, StorageAdapter, UploadTarget } from './types';
