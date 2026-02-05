import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@csn/shared-types': path.resolve(__dirname, '../../libs/shared/types/src/index.ts'),
      '@csn/shared-utils': path.resolve(__dirname, '../../libs/shared/utils/src/index.ts'),
      '@csn/shared-constants': path.resolve(__dirname, '../../libs/shared/constants/src/index.ts'),
    },
  },
  server: {
    port: 4200,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
