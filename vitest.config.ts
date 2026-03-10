import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'apps/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['libs/**/src/**/*.ts', 'apps/**/src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/index.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@csn/domain-shared': path.resolve(__dirname, 'libs/domain/shared/src'),
      '@csn/infra-auth': path.resolve(__dirname, 'libs/infrastructure/auth/src'),
      '@csn/infra-cache': path.resolve(__dirname, 'libs/infrastructure/cache/src'),
      '@csn/infra-database': path.resolve(__dirname, 'libs/infrastructure/database/src'),
      '@csn/infra-messaging': path.resolve(__dirname, 'libs/infrastructure/messaging/src'),
      '@csn/shared-types': path.resolve(__dirname, 'libs/shared/types/src'),
      '@csn/shared-utils': path.resolve(__dirname, 'libs/shared/utils/src'),
      '@csn/shared-constants': path.resolve(__dirname, 'libs/shared/constants/src'),
    },
  },
});
