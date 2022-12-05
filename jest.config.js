// eslint-disable-next-line no-undef
module.exports = {
  preset: 'ts-jest',
  coveragePathIgnorePatterns: [
    '/node_modules',
    '/tests/fixtures',
    '/tests/utils',
    '/src/index.ts',
    '/src/config',
    '/src/middlewares/error-middleware.ts',
    '/src/middlewares/limiter-middleware.ts',
    '/src/migrations'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  coverageReporters: ['lcov'],
  collectCoverage: true,
  setupFilesAfterEnv: ['./tests/testEnv.ts'],
  testTimeout: 10000
}
