import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: mode === 'extension' ? 'dist-extension' : 'dist',
    rolldownOptions: {
      input: mode === 'extension'
        ? { app: resolve(import.meta.dirname, 'index.html'), background: resolve(import.meta.dirname, 'src/extension/background.ts') }
        : resolve(import.meta.dirname, 'index.html'),
      output: { entryFileNames: '[name].js' },
    },
  },
}));
