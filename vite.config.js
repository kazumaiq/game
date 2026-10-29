import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: false,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
