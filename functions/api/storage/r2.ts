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

  async createAlbumFolder(classId: string, albumId: string): Promise<{ folderId: string }> {
    // R2 heeft geen echte folders; "folders" zijn key-prefixes. We maken dus
    // niets aan — de prefix ontstaat vanzelf bij de eerste upload. De folderId
    // is de prefix zelf, opgeslagen in het manifest.
    return { folderId: `albums/${classId}/${albumId}` };
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

  async deleteAlbumFolder(albumId: string): Promise<void> {
    // Verwijder alle objecten waarvan de key het album-segment bevat
    // (albums/<classId>/<albumId>/...). Doorloop de cursor voor grote albums.
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix: 'albums/', cursor, limit: 1000 });
      for (const obj of listing.objects) {
        if (obj.key.split('/')[2] === albumId) keys.push(obj.key);
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);

    // R2 delete accepteert een array van keys per call.
    for (let i = 0; i < keys.length; i += 1000) {
      await this.bucket.delete(keys.slice(i, i + 1000));
    }
  }
}
