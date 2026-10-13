import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': src },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/visual/**', 'node_modules/**'],
  },
});
