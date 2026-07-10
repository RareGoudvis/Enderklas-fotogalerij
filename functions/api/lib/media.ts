// Live media-listing uit R2 (geen foto-manifest, brief §5). De hoofdbestanden
// staan direct onder de albummap; thumbnails onder <map>/thumbs/.

/** Geef de photoId's (uuid zonder extensie) van alle hoofdbeelden in een album. */
export async function listPhotoIds(bucket: R2Bucket, folderId: string): Promise<string[]> {
  const prefix = `${folderId}/`;
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const obj of listing.objects) {
      const rest = obj.key.slice(prefix.length);
      // Alleen hoofdbeelden: geen submap (thumbs/…) en eindigt op .webp.
      if (!rest.includes('/') && rest.endsWith('.webp')) {
        ids.push(rest.slice(0, -'.webp'.length));
      }
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
  return ids;
}
