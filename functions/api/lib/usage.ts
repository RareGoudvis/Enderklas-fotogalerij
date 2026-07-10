// Bucketgebruik berekenen (R2-setup.md §3/§6). R2-specifiek — v1 draait enkel op
// R2, dus we lezen de binding rechtstreeks. Sommeert alle objecten onder albums/.

const GB = 1_000_000_000; // decimale GB, in lijn met de R2-vrije-tier (10 GB)

export async function computeUsedBytes(bucket: R2Bucket): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix: 'albums/', cursor, limit: 1000 });
    for (const obj of listing.objects) total += obj.size;
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
  return total;
}

export function bytesToGb(bytes: number): number {
  return bytes / GB;
}

export function gbToBytes(gb: number): number {
  return gb * GB;
}
