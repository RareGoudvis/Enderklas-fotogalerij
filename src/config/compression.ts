// Compressie-presets (R2-setup.md §3). Alle compressie gebeurt in de browser
// vóór upload; de server raakt de beeldbytes nooit aan behalve om ze op te slaan.

export type PresetName = 'hoog' | 'normaal' | 'zuinig';

export interface Preset {
  maxDim: number; // langste zijde in px; nooit opschalen
  quality: number; // WebP-kwaliteit 0..1
}

export const PRESETS: Record<PresetName, Preset> = {
  hoog: { maxDim: 3200, quality: 0.9 }, // ~2,0–2,5 MB — standaard, kwaliteit primeert (ruime headroom)
  normaal: { maxDim: 2560, quality: 0.85 }, // ~1,2 MB — lichte degradatie vlak bij de cap
  zuinig: { maxDim: 2048, quality: 0.8 }, // ~0,7 MB — laatste stap net onder de cap
};

// Auto-degradatiepunten op basis van bucketgebruik (GB). Bewust hoog gezet: bij
// ~800 foto's/jaar tegen een 9,8 GB-cap is de headroom enorm, dus degradatie
// start pas vlak bij de cap.
export const THRESHOLDS_GB = { normaal: 8, zuinig: 9.3 };

// Thumbnail-parameters (tweede pass).
export const THUMB = { maxDim: 400, quality: 0.72 };

/** Kies de preset automatisch op basis van het gebruik in GB. */
export function presetForUsage(usedGb: number): PresetName {
  if (usedGb >= THRESHOLDS_GB.zuinig) return 'zuinig';
  if (usedGb >= THRESHOLDS_GB.normaal) return 'normaal';
  return 'hoog';
}
