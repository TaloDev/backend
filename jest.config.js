// eslint-disable-next-line no-undef
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
  coverageReporters: ['lcov'],
  collectCoverage: true
}
