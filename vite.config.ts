import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
resolve: {
    alias: {
      mammoth: 'mammoth/mammoth.browser',
    },
  },
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
  },
});
