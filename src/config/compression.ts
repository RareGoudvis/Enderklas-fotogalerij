// Compressie-presets (R2-setup.md §3). Alle compressie gebeurt in de browser
// vóór upload; de server raakt de beeldbytes nooit aan behalve om ze op te slaan.

export type PresetName = 'hoog' | 'normaal' | 'zuinig';

export interface Preset {
  maxDim: number; // langste zijde in px; nooit opschalen
  quality: number; // WebP-kwaliteit 0..1
}

export const PRESETS: Record<PresetName, Preset> = {
  hoog: { maxDim: 2560, quality: 0.85 }, // ~1,0 MB — standaard, niet te onderscheiden op scherm & 10×15-print
  normaal: { maxDim: 2048, quality: 0.8 }, // ~600 KB
  zuinig: { maxDim: 1600, quality: 0.75 }, // ~350 KB — WhatsApp-niveau, nog steeds prima
};

// Auto-degradatiepunten op basis van bucketgebruik (GB).
export const THRESHOLDS_GB = { normaal: 6, zuinig: 8.5 };

// Thumbnail-parameters (tweede pass).
export const THUMB = { maxDim: 400, quality: 0.72 };

/** Kies de preset automatisch op basis van het gebruik in GB. */
export function presetForUsage(usedGb: number): PresetName {
  if (usedGb >= THRESHOLDS_GB.zuinig) return 'zuinig';
  if (usedGb >= THRESHOLDS_GB.normaal) return 'normaal';
  return 'hoog';
}
