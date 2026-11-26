import { generateCode, normaliseCode } from '../../../src/lib/auth/code.js'

describe('generateCode', () => {
  it('should always return exactly 6 characters from the alphabet', () => {
    const codes = Array.from({ length: 1000 }).map(() => generateCode())

    for (const code of codes) {
      expect(code).toHaveLength(6)
      expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRTUVWXY]+$/)
    }
  })
})

describe('normaliseCode', () => {
  it('should ignore case and surrounding space', () => {
    expect(normaliseCode(' ab12cd ')).toBe('AB12CD')
    expect(normaliseCode('123456')).toBe('123456')
  })
})
