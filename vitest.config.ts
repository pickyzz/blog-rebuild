import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.spec.ts'],
    exclude: ['src/tests/e2e/**', 'src/tests/**/index.spec.ts'],
    globals: true,
    setupFiles: 'src/tests/setup-vitest.ts',
    environment: 'node'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
