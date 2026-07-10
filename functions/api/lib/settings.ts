// App-instellingen in config/settings.json (R2-setup.md §3): optioneel een
// vastgepinde preset die de auto-degradatie overschrijft.

import type { PresetName } from '../../../src/config/compression';
import type { StorageAdapter } from '../storage';

export const SETTINGS_PATH = 'config/settings.json';

export interface Settings {
  /** Door de beheerder vastgepinde preset; overschrijft auto-selectie. */
  pinnedPreset?: PresetName;
}

export async function readSettings(storage: StorageAdapter): Promise<Settings> {
  const res = await storage.readJson(SETTINGS_PATH);
  return res ? (res.data as Settings) : {};
}
