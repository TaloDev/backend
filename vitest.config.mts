import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    dir: './tests',
    setupFiles: './tests/setupTest.ts',
    maxWorkers: 1,
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: 'lcov',
      include: ['src/**/*.ts'],
      exclude: [
        '__mocks__',
        'node_modules',
        'dist',
        'tests',
        'src/global.d.ts',
        'src/index.ts',
        'src/config',
        'src/migrations',
        'src/middleware/error-middleware.ts',
        'src/middleware/limiter-middleware.ts',
        'src/middleware/logger-middleware.ts',
        'src/middleware/http-tracing-middleware.ts',
        'src/lib/clickhouse/clickhouse-entity.ts',
        'src/lib/clickhouse/createClient.ts',
        'src/lib/errors/checkRateLimitExceeded.ts',
        'src/lib/tracing',
        'src/socket/enableSocketTracing.ts',
      ],
    },
  },
})
