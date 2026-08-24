import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
    external: ['mysql2', 'mysql2/promise', 'node:sqlite'],
    },
  },
});
