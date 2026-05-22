import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'packages/admin/src'),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: [
      'packages/**/tests/**/*.test.ts',
      'packages/**/tests/**/*.test.tsx',
    ],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/admin/src/lib/**/*.ts',
        'packages/miniprogram/miniprogram/services/tracking.ts',
        'packages/miniprogram/miniprogram/services/purchase.ts',
        'packages/miniprogram/cloudfunctions/**/rules.js',
      ],
      exclude: [
        '**/*.d.ts',
      ],
    },
  },
})
