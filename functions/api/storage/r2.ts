// R2-implementatie van de StorageAdapter (R2-setup.md §4).
//
// v1-scope: readJson/writeJson met conditionele writes zijn hier volledig
// geïmplementeerd (nodig voor de manifests met ETag-retry, brief §5). De media-
// methodes (folders, uploads, listings, downloads, delete) worden in latere
// sprints ingevuld en gooien voorlopig een duidelijke fout.

import {
  ConflictError,
  type MediaItem,
  type StorageAdapter,
  type UploadTarget,
} from './types';

const NOT_YET = 'Nog niet geïmplementeerd in deze sprint';

export class R2Storage implements StorageAdapter {
  constructor(private readonly bucket: R2Bucket) {}

  async readJson(path: string): Promise<{ data: unknown; etag: string } | null> {
    const obj = await this.bucket.get(path);
    if (obj === null) return null;
    const data = await obj.json<unknown>();
    // obj.etag is de onquoted ETag; symmetrisch met writeJson's onlyIf.etagMatches.
    return { data, etag: obj.etag };
  }

  async writeJson(path: string, data: unknown, ifMatchEtag?: string): Promise<void> {
    const body = JSON.stringify(data);
    const httpMetadata = { contentType: 'application/json; charset=utf-8' };

    if (ifMatchEtag === undefined) {
      // Onvoorwaardelijke write (bv. eerste aanmaak).
      await this.bucket.put(path, body, { httpMetadata });
      return;
    }

    // Conditionele write: enkel schrijven als de ETag nog steeds klopt.
    // R2 geeft null terug wanneer de voorwaarde faalt (iemand anders schreef
    // ondertussen) → vertaal naar ConflictError zodat de aanroeper her-leest
    // en opnieuw probeert (retry-once, brief §5).
    const result = await this.bucket.put(path, body, {
      httpMetadata,
      onlyIf: { etagMatches: ifMatchEtag },
    });
    if (result === null) throw new ConflictError(path);
  }

  createAlbumFolder(_classId: string, _albumId: string): Promise<{ folderId: string }> {
    // R2 heeft geen echte folders; "folders" zijn key-prefixes. Wordt ingevuld
    // bij het aanmaken van albums (Sprint 3).
    throw new Error(NOT_YET);
  }

  createUploadTarget(
    _albumId: string,
    _file: { name: string; size: number; mime: string },
  ): Promise<UploadTarget> {
    throw new Error(NOT_YET);
  }

  listAlbum(_albumId: string): Promise<MediaItem[]> {
    throw new Error(NOT_YET);
  }

  getDownloadUrl(_albumId: string, _itemId: string): Promise<string> {
    throw new Error(NOT_YET);
  }

  async getAlbumDownloadLink(_albumId: string): Promise<string | null> {
    // Op R2 bestaat er geen server-side zip-link; de client zipt met client-zip
    // (R2-setup.md §4). Bewust null.
    return null;
  }

  deleteAlbumFolder(_albumId: string): Promise<void> {
    throw new Error(NOT_YET);
  }
}
