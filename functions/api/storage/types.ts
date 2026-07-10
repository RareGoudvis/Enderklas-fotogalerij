// Storage-abstractie (brief §2).
//
// ALLE opslagtoegang loopt via deze ene interface, zodat de backend een
// env-var-switch is (STORAGE_BACKEND=r2|sharepoint) en geen code-jacht.
// v1 draait uitsluitend op de R2-implementatie; SharePoint is een stub voor
// de latere migratie (brief §14).

/** Eén media-item in een album, zoals getoond in de galerij. */
export interface MediaItem {
  /** Object-id (nanoid-bestandsnaam zonder extensie), stabiel binnen het album. */
  id: string;
  /** Bestandsnaam in de opslag, bv. "<uuid>.webp". */
  name: string;
  mime: string;
  size: number;
  /** Token-gated URL naar de thumbnail (klein formaat). */
  thumbnailUrl: string;
  /** Token-gated URL naar de volledige afbeelding. */
  fullUrl: string;
  /** ISO8601 uploadtijd, indien bekend. */
  uploadedAt?: string;
}

/** Doelbeschrijving om een bestand naartoe te uploaden. */
export interface UploadTarget {
  /**
   * Vooraf-geautoriseerde upload-URL (SharePoint upload session).
   * Op R2 ongebruikt — daar uploadt de browser via een gewone multipart POST
   * naar de Function, die rechtstreeks naar de bucket streamt (R2-setup.md §3).
   */
  uploadUrl?: string;
  /** Interne sleutel/pad waar het object belandt. */
  key: string;
}

/**
 * De storage-adapter. Elke methode is backend-onafhankelijk beschreven;
 * de implementatie vertaalt naar R2- of Graph-operaties.
 */
export interface StorageAdapter {
  /** Lees JSON + ETag; null als het pad niet bestaat. */
  readJson(path: string): Promise<{ data: unknown; etag: string } | null>;
  /**
   * Schrijf JSON. Als ifMatchEtag gegeven is, faalt de write met een
   * ConflictError wanneer de huidige ETag niet overeenkomt (optimistic locking,
   * brief §5 shared-album hot path).
   */
  writeJson(path: string, data: unknown, ifMatchEtag?: string): Promise<void>;

  createAlbumFolder(classId: string, albumId: string): Promise<{ folderId: string }>;
  createUploadTarget(
    albumId: string,
    file: { name: string; size: number; mime: string },
  ): Promise<UploadTarget>;
  /** Live-lijst van media in een album, inclusief thumbnail-URLs. */
  listAlbum(albumId: string): Promise<MediaItem[]>;
  /** Kortlevende download-URL voor één bestand. */
  getDownloadUrl(albumId: string, itemId: string): Promise<string>;
  /** Download-alles-link; null op R2 (daar wordt client-zip gebruikt, R2-setup.md §4). */
  getAlbumDownloadLink(albumId: string): Promise<string | null>;
  deleteAlbumFolder(albumId: string): Promise<void>;
}

/**
 * Gegooid wanneer een conditionele write faalt door een ETag-mismatch.
 * De aanroeper her-leest en probeert opnieuw (retry-once, brief §5).
 */
export class ConflictError extends Error {
  constructor(path: string) {
    super(`ETag-conflict bij schrijven naar ${path}`);
    this.name = 'ConflictError';
  }
}
