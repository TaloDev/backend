import Prop from '../../../src/entities/prop'
import { MAX_ARRAY_LENGTH, mergeAndSanitiseProps } from '../../../src/lib/props/sanitiseProps'

function makeProp(key: string, value: string) {
  return new Prop(key, value)
}

describe('mergeAndSanitiseProps', () => {
  describe('scalar keys', () => {
    it('should keep new prop when key not in prev', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [{ key: 'foo', value: 'bar' }],
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: 'foo', value: 'bar' })
    })

    it('should override prev prop with same key', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('foo', 'old')],
        newProps: [{ key: 'foo', value: 'new' }],
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: 'foo', value: 'new' })
    })

    it('should keep prev props whose keys are not in newProps', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('a', '1'), makeProp('b', '2')],
        newProps: [{ key: 'a', value: 'updated' }],
      })
      expect(result).toHaveLength(2)
      expect(result.find((p) => p.key === 'a')?.value).toBe('updated')
      expect(result.find((p) => p.key === 'b')?.value).toBe('2')
    })

    it('should delete scalar prop when value is null', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('foo', 'bar')],
        newProps: [{ key: 'foo', value: null }],
      })
      expect(result).toHaveLength(0)
    })
  })

  describe('array keys ([] suffix)', () => {
    it('should store multiple props with the same [] key', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'b' },
        ],
      })
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.value).sort()).toEqual(['a', 'b'])
    })

    it('should replace all existing [] props with the same key', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('tags[]', 'old1'), makeProp('tags[]', 'old2')],
        newProps: [
          { key: 'tags[]', value: 'new1' },
          { key: 'tags[]', value: 'new2' },
        ],
      })
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.value).sort()).toEqual(['new1', 'new2'])
    })

    it('should delete all [] props with the given key when value is null', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('tags[]', 'a'), makeProp('tags[]', 'b')],
        newProps: [{ key: 'tags[]', value: null }],
      })
      expect(result).toHaveLength(0)
    })

    it('should deduplicate values within the same [] key', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'b' },
        ],
      })
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.value).sort()).toEqual(['a', 'b'])
    })

    it('should not affect [] props with different keys', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('colors[]', 'red')],
        newProps: [{ key: 'tags[]', value: 'a' }],
      })
      expect(result).toHaveLength(2)
      expect(result.find((p) => p.key === 'colors[]')?.value).toBe('red')
      expect(result.find((p) => p.key === 'tags[]')?.value).toBe('a')
    })
  })

  describe('array length limit', () => {
    it('should throw when a [] key exceeds MAX_ARRAY_LENGTH items', () => {
      const newProps = Array.from({ length: MAX_ARRAY_LENGTH + 1 }, (_, i) => ({
        key: 'tags[]',
        value: String(i),
      }))
      expect(() => mergeAndSanitiseProps({ prevProps: [], newProps })).toThrow(
        `Prop array length (${MAX_ARRAY_LENGTH + 1}) for key 'tags[]' exceeds ${MAX_ARRAY_LENGTH} items`,
      )
    })

    it('should not throw when a [] key is exactly at MAX_ARRAY_LENGTH items', () => {
      const newProps = Array.from({ length: MAX_ARRAY_LENGTH }, (_, i) => ({
        key: 'tags[]',
        value: String(i),
      }))
      expect(() => mergeAndSanitiseProps({ prevProps: [], newProps })).not.toThrow()
    })
  })

  describe('extraFilter', () => {
    it('should preserve [] props excluded by extraFilter', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('META_tags[]', 'internal')],
        newProps: [{ key: 'META_tags[]', value: 'override' }],
        extraFilter: (p) => !p.key.startsWith('META_'),
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ key: 'META_tags[]', value: 'internal' })
    })
  })

  describe('mixed scalar and array keys', () => {
    it('should handle scalar and array props together', () => {
      const result = mergeAndSanitiseProps({
        prevProps: [makeProp('name', 'Alice'), makeProp('tags[]', 'old')],
        newProps: [
          { key: 'name', value: 'Bob' },
          { key: 'tags[]', value: 'new1' },
          { key: 'tags[]', value: 'new2' },
        ],
      })
      expect(result).toHaveLength(3)
      expect(result.find((p) => p.key === 'name')?.value).toBe('Bob')
      const tags = result
        .filter((p) => p.key === 'tags[]')
        .map((p) => p.value)
        .sort()
      expect(tags).toEqual(['new1', 'new2'])
    })
  })
})
