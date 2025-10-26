import { escapeCSVValue } from '../../../src/lib/lang/escapeCSVValue'

describe('escapeCSVValue', () => {
  it('should not escape simple values without special characters', () => {
    expect(escapeCSVValue('Hello')).toBe('Hello')
    expect(escapeCSVValue('World123')).toBe('World123')
    expect(escapeCSVValue('simple-value')).toBe('simple-value')
  })

  it('should escape values containing commas', () => {
    expect(escapeCSVValue('Hello, World')).toBe('"Hello, World"')
    expect(escapeCSVValue('one,two,three')).toBe('"one,two,three"')
  })

  it('should escape values containing double quotes', () => {
    expect(escapeCSVValue('Say "Hi"')).toBe('"Say ""Hi"""')
    expect(escapeCSVValue('"quoted"')).toBe('"""quoted"""')
  })

  it('should escape values containing newlines', () => {
    expect(escapeCSVValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"')
    expect(escapeCSVValue('Hello\n\nWorld')).toBe('"Hello\n\nWorld"')
  })

  it('should escape values containing carriage returns', () => {
    expect(escapeCSVValue('Line 1\rLine 2')).toBe('"Line 1\rLine 2"')
    expect(escapeCSVValue('Windows\r\nNewline')).toBe('"Windows\r\nNewline"')
  })

  it('should escape values with multiple special characters', () => {
    expect(escapeCSVValue('Hello, "World"\nNew line')).toBe('"Hello, ""World""\nNew line"')
    expect(escapeCSVValue('Complex, value with "quotes" and\nnewlines')).toBe('"Complex, value with ""quotes"" and\nnewlines"')
  })

  it('should handle empty strings', () => {
    expect(escapeCSVValue('')).toBe('')
  })

  it('should handle json', () => {
    expect(escapeCSVValue('{"key": "value"}')).toBe('"{""key"": ""value""}"')
    expect(escapeCSVValue('{"coords": "(100,50)"}')).toBe('"{""coords"": ""(100,50)""}"')
  })
})
