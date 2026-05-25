import Prop from '../../../src/entities/prop.js'
import { MAX_ARRAY_LENGTH, mergeAndSanitiseProps } from '../../../src/lib/props/sanitiseProps.js'

function makeProp(key: string, value: string) {
  return new Prop(key, value)
}

describe('mergeAndSanitiseProps', () => {
  describe('scalar keys', () => {
    it('should keep a new prop', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [{ key: 'foo', value: 'bar' }],
      })

      expect(accepted).toHaveLength(1)
      expect(accepted[0]).toMatchObject({ key: 'foo', value: 'bar' })
    })

    it('should override a prev prop with the same key', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('foo', 'old')],
        newProps: [{ key: 'foo', value: 'new' }],
      })

      expect(accepted).toHaveLength(1)
      expect(accepted[0]).toMatchObject({ key: 'foo', value: 'new' })
    })

    it('should keep prev props whose keys are not in newProps', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('a', '1'), makeProp('b', '2')],
        newProps: [{ key: 'a', value: 'updated' }],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.find((p) => p.key === 'a')?.value).toBe('updated')
      expect(accepted.find((p) => p.key === 'b')?.value).toBe('2')
    })

    it('should delete scalar props when their value is null', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('foo', 'bar')],
        newProps: [{ key: 'foo', value: null }],
      })

      expect(accepted).toHaveLength(0)
    })
  })

  describe('array keys', () => {
    it('should store multiple props with the same [] key', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'b' },
        ],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.map((p) => p.value).sort()).toEqual(['a', 'b'])
    })

    it('should replace all existing [] props with the same key', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('tags[]', 'old1'), makeProp('tags[]', 'old2')],
        newProps: [
          { key: 'tags[]', value: 'new1' },
          { key: 'tags[]', value: 'new2' },
        ],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.map((p) => p.value).sort()).toEqual(['new1', 'new2'])
    })

    it('should delete all [] props with the given key when the value is null', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('tags[]', 'a'), makeProp('tags[]', 'b')],
        newProps: [{ key: 'tags[]', value: null }],
      })

      expect(accepted).toHaveLength(0)
    })

    it('should deduplicate values within the same [] key', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'b' },
        ],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.map((p) => p.value).sort()).toEqual(['a', 'b'])
    })

    it('should not affect [] props with different keys', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('colors[]', 'red')],
        newProps: [{ key: 'tags[]', value: 'a' }],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.find((p) => p.key === 'colors[]')?.value).toBe('red')
      expect(accepted.find((p) => p.key === 'tags[]')?.value).toBe('a')
    })

    it('should filter out null values from arrays', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [],
        newProps: [
          { key: 'tags[]', value: 'a' },
          { key: 'tags[]', value: 'b' },
          { key: 'tags[]', value: null },
        ],
      })

      expect(accepted).toHaveLength(2)
      expect(accepted.map((p) => p.value).sort()).toEqual(['a', 'b'])
    })
  })

  describe('array length limit', () => {
    it('should reject when a [] key exceeds MAX_ARRAY_LENGTH items', () => {
      const newProps = Array.from({ length: MAX_ARRAY_LENGTH + 1 }, (_, i) => ({
        key: 'tags[]',
        value: String(i),
      }))

      const { accepted, rejected } = mergeAndSanitiseProps({ prevProps: [], newProps })
      expect(rejected).toHaveLength(1)
      expect(rejected[0].error).toBe('PROP_ARRAY_TOO_LONG')
      expect(rejected[0].message).toBe(
        `Prop array length (${MAX_ARRAY_LENGTH + 1}) for key 'tags[]' exceeds ${MAX_ARRAY_LENGTH} items`,
      )
      expect(accepted.filter((p) => p.key === 'tags[]')).toHaveLength(0)
    })

    it('should not reject when a [] key is exactly at MAX_ARRAY_LENGTH items', () => {
      const newProps = Array.from({ length: MAX_ARRAY_LENGTH }, (_, i) => ({
        key: 'tags[]',
        value: String(i),
      }))

      const { rejected } = mergeAndSanitiseProps({ prevProps: [], newProps })
      expect(rejected).toHaveLength(0)
    })
  })

  describe('extraFilter', () => {
    it('should preserve [] props excluded by extraFilter', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('META_tags[]', 'internal')],
        newProps: [{ key: 'META_tags[]', value: 'override' }],
        extraFilter: (p) => !p.key.startsWith('META_'),
      })

      expect(accepted).toHaveLength(1)
      expect(accepted[0]).toMatchObject({ key: 'META_tags[]', value: 'internal' })
    })
  })

  describe('mixed scalar and array keys', () => {
    it('should handle scalar and array props together', () => {
      const { accepted } = mergeAndSanitiseProps({
        prevProps: [makeProp('name', 'Alice'), makeProp('tags[]', 'old')],
        newProps: [
          { key: 'name', value: 'Bob' },
          { key: 'tags[]', value: 'new1' },
          { key: 'tags[]', value: 'new2' },
        ],
      })

      expect(accepted).toHaveLength(3)
      expect(accepted.find((p) => p.key === 'name')?.value).toBe('Bob')

      const tags = accepted
        .filter((p) => p.key === 'tags[]')
        .map((p) => p.value)
        .sort()
      expect(tags).toEqual(['new1', 'new2'])
    })
  })
})
