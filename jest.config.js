module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/fixtures/',
    '/tests/utils/'
  ],
  coverageReporters: ['lcov']
}
