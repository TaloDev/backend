import Prop from '../../../src/entities/prop.js'
import { filterProfaneProps } from '../../../src/lib/props/filterProfaneProps.js'

describe('filterProfaneProps', () => {
  it('should return all props as accepted when disabled', () => {
    const props = [new Prop('name', 'fuck'), new Prop('level', '5')]
    const { accepted, rejected } = filterProfaneProps(props, false)
    expect(accepted).toEqual(props)
    expect(rejected).toEqual([])
  })

  it('should reject props with profane values when enabled', () => {
    const props = [new Prop('name', 'fuck'), new Prop('level', '5')]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual([props[1]])
    expect(rejected).toEqual([
      { key: 'name', error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' },
    ])
  })

  it('should accept all props with clean values when enabled', () => {
    const props = [new Prop('name', 'Alice'), new Prop('level', '5')]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual(props)
    expect(rejected).toEqual([])
  })

  it('should handle empty props array', () => {
    const { accepted, rejected } = filterProfaneProps([], true)
    expect(accepted).toEqual([])
    expect(rejected).toEqual([])
  })

  it('should reject entire array key if any value is profane', () => {
    const props = [
      new Prop('tags[]', 'good'),
      new Prop('tags[]', 'fuck'),
      new Prop('name', 'Alice'),
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual([props[2]])
    expect(rejected).toEqual([
      { key: 'tags[]', error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' },
    ])
  })

  it('should deduplicate rejections for the same key', () => {
    const props = [new Prop('name', 'fuck')]
    const { rejected } = filterProfaneProps(props, true)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].key).toBe('name')
  })

  it('should work with unsanitised props (nullable values)', () => {
    const props = [
      { key: 'bio', value: 'fuck' },
      { key: 'name', value: 'Alice' },
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual([{ key: 'name', value: 'Alice' }])
    expect(rejected).toEqual([
      { key: 'bio', error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' },
    ])
  })

  it('should reject entire array key for unsanitised props if any value is profane', () => {
    const props = [
      { key: 'tags[]', value: 'good' },
      { key: 'tags[]', value: 'fuck' },
      { key: 'tags[]', value: 'ok' },
      { key: 'name', value: 'Alice' },
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual([{ key: 'name', value: 'Alice' }])
    expect(rejected).toEqual([
      { key: 'tags[]', error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' },
    ])
  })

  it('should accept array keys with all clean values for unsanitised props', () => {
    const props = [
      { key: 'tags[]', value: 'good' },
      { key: 'tags[]', value: 'ok' },
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual(props)
    expect(rejected).toEqual([])
  })

  it('should preserve null values in accepted unsanitised props', () => {
    const props = [
      { key: 'bio', value: null },
      { key: 'name', value: 'Alice' },
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual(props)
    expect(rejected).toEqual([])
  })

  it('should reject array key with mixed null and profane values', () => {
    const props = [
      { key: 'tags[]', value: null },
      { key: 'tags[]', value: 'fuck' },
      { key: 'name', value: 'Alice' },
    ]
    const { accepted, rejected } = filterProfaneProps(props, true)
    expect(accepted).toEqual([{ key: 'name', value: 'Alice' }])
    expect(rejected).toEqual([
      { key: 'tags[]', error: 'PROP_CONTAINS_PROFANITY', message: 'Prop value contains profanity' },
    ])
  })
})
