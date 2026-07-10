// SharePoint-stub (brief §2, §14).
//
// Bewust NIET geïmplementeerd in v1. Bestaat zodat de storage-switch een
// env-var-wijziging is (STORAGE_BACKEND=sharepoint) en geen nieuwe code-structuur.
// Wordt pas ingevuld als de school-IT de Graph-setup goedkeurt (migratie, brief §14).
// Elke methode gooit, zodat per ongeluk selecteren luid faalt i.p.v. stil.

import type { MediaItem, StorageAdapter, UploadTarget } from './types';

const STUB = 'SharePoint-backend is niet beschikbaar in deze versie (enkel R2).';

export class SharePointStorage implements StorageAdapter {
  readJson(_path: string): Promise<{ data: unknown; etag: string } | null> {
    throw new Error(STUB);
  }
  writeJson(_path: string, _data: unknown, _ifMatchEtag?: string): Promise<void> {
    throw new Error(STUB);
  }
  createAlbumFolder(_classId: string, _albumId: string): Promise<{ folderId: string }> {
    throw new Error(STUB);
  }
  createUploadTarget(
    _albumId: string,
    _file: { name: string; size: number; mime: string },
  ): Promise<UploadTarget> {
    throw new Error(STUB);
  }
  listAlbum(_albumId: string): Promise<MediaItem[]> {
    throw new Error(STUB);
  }
  getDownloadUrl(_albumId: string, _itemId: string): Promise<string> {
    throw new Error(STUB);
  }
  getAlbumDownloadLink(_albumId: string): Promise<string | null> {
    throw new Error(STUB);
  }
  deleteAlbumFolder(_albumId: string): Promise<void> {
    throw new Error(STUB);
  }
}
