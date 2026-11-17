import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built files go to ./dist, then scripts/deploy.mjs copies them to the repo root,
// which is what GitHub Pages serves for realestate.digidecide.in.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
