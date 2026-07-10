// Vaste, jaarlijks bij te werken constanten.

/** Huidig schooljaar — gebruikt in exportbestandsnamen (brief §5). */
export const SCHOOLJAAR = '2026-2027';

/**
 * Retentie-deadline, getoond aan ouders (brief §7). BEWUST alleen getoond,
 * niet afgedwongen — de wipe blijft handmatig. Zet dit elk schooljaar juist.
 */
export const WIPE_DEADLINE_LABEL = '1 augustus';

/** De verplichte, niet-wegklikbare retentiemelding op elke albumweergave. */
export const RETENTION_NOTICE = `📅 Dit album is beschikbaar tot ${WIPE_DEADLINE_LABEL}. Download de foto's die je wil bewaren vóór die datum.`;
