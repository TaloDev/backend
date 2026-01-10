import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    setupFiles: './tests/setupTest.ts',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
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
        // temporary while migrating to the new router
        'src/middleware/policy-middleware.ts',
        'src/middleware/validator-middleware.ts',
        'src/lib/routing/router.ts'
      ]
    }
  }
})
