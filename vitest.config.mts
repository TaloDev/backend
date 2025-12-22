import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    setupFiles: './tests/setupTest.ts',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1
      }
    },
    hookTimeout: 30_000,
    deps: {
      interopDefault: true
    },
    coverage: {
      provider: 'v8',
      reporter: 'lcov',
      exclude: [
        '__mocks__',
        'tests',
        'eslint.config.mjs',
        'src/index.ts',
        'src/config',
        'src/middleware/error-middleware.ts',
        'src/middleware/limiter-middleware.ts',
        'src/middleware/logger-middleware.ts',
        'src/middleware/http-tracing-middleware.ts',
        'src/migrations',
        'src/global.d.ts',
        'src/lib/clickhouse/clickhouse-entity.ts',
        'src/lib/clickhouse/createClient.ts',
        'src/lib/errors/checkRateLimitExceeded.ts',
        'src/lib/tracing'
      ]
    }
  }
})
