import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the Phaser engine in its own cacheable chunk so app/UI changes
        // do not force mobile browsers to redownload the whole game runtime.
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser-engine';
        },
      },
    },
  },
});
