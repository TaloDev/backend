import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    setupFiles: './tests/setupTest.ts',
    poolOptions: {
      threads: {
        singleThread: true
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
        'src/middlewares/error-middleware.ts',
        'src/middlewares/limiter-middleware.ts',
        'src/migrations',
        'src/global.d.ts'
      ]
    }
  }
})
