import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/* GitHub Pages serves 404.html for any unknown path. Shipping the app shell
   under that name lets /cardapio or /produto/x load directly or after a reload,
   while BrowserRouter keeps clean URLs. */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bella-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    }
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), spaFallback()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200
  }
});
