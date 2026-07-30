import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    exclude: ['worker/**', 'node_modules/**', 'dist/**'],
  },
});
