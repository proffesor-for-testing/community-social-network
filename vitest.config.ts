import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'apps/**/*.spec.ts', 'tests/**/*.spec.ts'],
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
      '@csn/domain-content': path.resolve(__dirname, 'libs/domain/content/src'),
      '@csn/domain-notification': path.resolve(__dirname, 'libs/domain/notification/src'),
      '@csn/domain-admin': path.resolve(__dirname, 'libs/domain/admin/src'),
      '@csn/domain-community': path.resolve(__dirname, 'libs/domain/community/src'),
      '@csn/domain-social-graph': path.resolve(__dirname, 'libs/domain/social-graph/src'),
      '@csn/domain-profile': path.resolve(__dirname, 'libs/domain/profile/src'),
      '@csn/domain-identity': path.resolve(__dirname, 'libs/domain/identity/src'),
      '@csn/infra-shared': path.resolve(__dirname, 'libs/infrastructure/shared/src'),
      '@csn/infra-identity': path.resolve(__dirname, 'libs/infrastructure/identity/src'),
      '@csn/infra-profile': path.resolve(__dirname, 'libs/infrastructure/profile/src'),
      '@csn/infra-content': path.resolve(__dirname, 'libs/infrastructure/content/src'),
      '@csn/infra-social-graph': path.resolve(__dirname, 'libs/infrastructure/social-graph/src'),
      '@csn/infra-community': path.resolve(__dirname, 'libs/infrastructure/community/src'),
      '@csn/infra-notification': path.resolve(__dirname, 'libs/infrastructure/notification/src'),
      '@csn/infra-admin': path.resolve(__dirname, 'libs/infrastructure/admin/src'),
      '@csn/infra-auth': path.resolve(__dirname, 'libs/infrastructure/auth/src'),
      '@csn/infra-cache': path.resolve(__dirname, 'libs/infrastructure/cache/src'),
      '@csn/infra-database': path.resolve(__dirname, 'libs/infrastructure/database/src'),
      '@csn/infra-messaging': path.resolve(__dirname, 'libs/infrastructure/messaging/src'),
      '@csn/infra-observability': path.resolve(__dirname, 'libs/infrastructure/observability/src'),
      '@csn/infra-gdpr': path.resolve(__dirname, 'libs/infrastructure/gdpr/src'),
      '@csn/infra-storage': path.resolve(__dirname, 'libs/infrastructure/storage/src'),
      '@csn/infra-email': path.resolve(__dirname, 'libs/infrastructure/email/src'),
      '@csn/shared-types': path.resolve(__dirname, 'libs/shared/types/src'),
      '@csn/shared-utils': path.resolve(__dirname, 'libs/shared/utils/src'),
      '@csn/shared-constants': path.resolve(__dirname, 'libs/shared/constants/src'),
    },
  },
});
