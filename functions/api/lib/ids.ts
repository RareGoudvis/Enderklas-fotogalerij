// Album-id-generator: 8-char nanoid (brief §7 — bewust géén UUID, links moeten
// kort blijven voor de nieuwsbrief). Alfabet is URL-veilig alfanumeriek.

import { customAlphabet } from 'nanoid';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const newAlbumId = customAlphabet(ALPHABET, 8);
