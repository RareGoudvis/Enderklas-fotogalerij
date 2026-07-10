import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite bouwt enkel de frontend (src/) naar dist/.
// De Cloudflare Pages Functions in /functions worden apart door het
// Pages-platform (of wrangler pages dev) uitgevoerd — niet door Vite.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
