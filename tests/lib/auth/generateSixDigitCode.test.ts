import { generateSixDigitCode } from '../../../src/lib/auth/generateSixDigitCode.js'

describe('generateSixDigitCode', () => {
  it('should always return exactly 6 digits', () => {
    const codes = Array.from({ length: 1000 }).map(() => generateSixDigitCode())

    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/)
    }
  })
})
