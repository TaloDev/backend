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
        'src/index.ts',
        'src/config',
        'src/middleware/error-middleware.ts',
        'src/middleware/limiter-middleware.ts',
        'src/migrations',
        'src/global.d.ts',
        'src/lib/clickhouse/clickhouse-entity.ts'
      ]
    }
  }
})
