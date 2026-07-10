// Samengestelde exportbestandsnamen (brief §5): camera-namen worden bewust niet
// bewaard; bij het serveren/exporteren heet elk bestand
//   [schooljaar]-[album-slug]-[photoId].webp
// zelf-beschrijvend, ook als het later los uit zijn map gesleept wordt.

import { SCHOOLJAAR } from '../../../src/config/constants';

/** Maak een URL/bestandsveilige slug van een albumtitel. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accenten weg
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'album';
}

/** photoId = de nanoid-bestandsnaam zonder extensie. */
export function composedFilename(albumName: string, photoId: string): string {
  return `${SCHOOLJAAR}-${slugify(albumName)}-${photoId}.webp`;
}
