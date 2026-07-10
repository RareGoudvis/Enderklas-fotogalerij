// Gedeelde omgevings-typering voor alle Pages Functions.
// Bindings + env-vars komen uit wrangler.toml en de Cloudflare-dashboard
// (encrypted secrets). Zie brief §11 en R2-setup.md §2.

export type StorageBackend = 'r2' | 'sharepoint';
export type AuthMode = 'password' | 'sso';

export interface Env {
  // Bindings
  BUCKET: R2Bucket;

  // Config
  STORAGE_BACKEND: StorageBackend;
  AUTH_MODE: AuthMode;
  BOOTSTRAP_ADMIN_EMAIL: string;
  STORAGE_HARD_CAP_GB: string; // string uit env; parse waar nodig

  // Secrets
  SESSION_SECRET: string;
  SHARE_SECRET: string;
}
