import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { extractParamsFromSchema } from '../../../src/lib/docs/schema-introspector'

describe('extractParamsFromSchema', () => {
  describe('basic types', () => {
    it('should extract string type', () => {
      const schema = {
        body: z.object({
          name: z.string()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name).toEqual({
        type: 'string',
        required: true,
        description: undefined
      })
    })

    it('should extract number type', () => {
      const schema = {
        body: z.object({
          count: z.number()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.count).toEqual({
        type: 'number',
        required: true,
        description: undefined
      })
    })

    it('should extract int as number type', () => {
      const schema = {
        body: z.object({
          count: z.int()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.count?.type).toBe('number')
    })

    it('should extract boolean type', () => {
      const schema = {
        body: z.object({
          enabled: z.boolean()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.enabled).toEqual({
        type: 'boolean',
        required: true,
        description: undefined
      })
    })

    it('should extract array type', () => {
      const schema = {
        body: z.object({
          items: z.array(z.string())
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.items?.type).toBe('array')
    })

    it('should extract object type', () => {
      const schema = {
        body: z.object({
          data: z.object({ key: z.string() })
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.data?.type).toBe('object')
    })

    it('should extract enum type', () => {
      const schema = {
        body: z.object({
          status: z.enum(['active', 'inactive'])
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.status?.type).toBe('enum')
    })

    it('should extract email as string type', () => {
      const schema = {
        body: z.object({
          email: z.email()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.email?.type).toBe('string')
    })

    it('should extract uuid as string type', () => {
      const schema = {
        body: z.object({
          id: z.uuid()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.id?.type).toBe('string')
    })
  })

  describe('optional and required', () => {
    it('should mark required fields as required', () => {
      const schema = {
        body: z.object({
          name: z.string()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.required).toBe(true)
    })

    it('should mark optional fields as not required', () => {
      const schema = {
        body: z.object({
          name: z.string().optional()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.required).toBe(false)
    })

    it('should mark nullable fields as not required', () => {
      const schema = {
        body: z.object({
          name: z.string().nullable()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.required).toBe(false)
    })

    it('should mark fields with default as not required', () => {
      const schema = {
        body: z.object({
          count: z.number().default(0)
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.count?.required).toBe(false)
    })

    it('should unwrap nested optionals correctly', () => {
      const schema = {
        body: z.object({
          name: z.string().optional().nullable()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.required).toBe(false)
      expect(result.body?.name?.type).toBe('string')
    })
  })

  describe('descriptions', () => {
    it('should extract description from meta', () => {
      const schema = {
        body: z.object({
          name: z.string().meta({ description: 'The user name' })
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.description).toBe('The user name')
    })

    it('should extract description from describe', () => {
      const schema = {
        body: z.object({
          name: z.string().describe('The user name')
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.description).toBe('The user name')
    })

    it('should extract description when meta is after optional', () => {
      const schema = {
        body: z.object({
          name: z.string().optional().meta({ description: 'The user name' })
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name?.description).toBe('The user name')
      expect(result.body?.name?.required).toBe(false)
    })

    it('should extract description when meta is after default', () => {
      const schema = {
        body: z.object({
          count: z.number().default(0).meta({ description: 'Item count' })
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.count?.description).toBe('Item count')
      expect(result.body?.count?.required).toBe(false)
    })
  })

  describe('schema locations', () => {
    it('should extract body params', () => {
      const schema = {
        body: z.object({
          name: z.string()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body).toBeDefined()
      expect(result.body?.name).toBeDefined()
    })

    it('should extract query params', () => {
      const schema = {
        query: z.object({
          page: z.number()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.query).toBeDefined()
      expect(result.query?.page).toBeDefined()
    })

    it('should extract route params', () => {
      const schema = {
        route: z.object({
          id: z.string()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.route).toBeDefined()
      expect(result.route?.id).toBeDefined()
    })

    it('should extract header params', () => {
      const schema = {
        headers: z.object({
          authorization: z.string()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.headers).toBeDefined()
      expect(result.headers?.authorization).toBeDefined()
    })

    it('should extract from multiple locations', () => {
      const schema = {
        body: z.object({ name: z.string() }),
        query: z.object({ page: z.number() }),
        route: z.object({ id: z.string() })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name).toBeDefined()
      expect(result.query?.page).toBeDefined()
      expect(result.route?.id).toBeDefined()
    })
  })

  describe('complex schemas', () => {
    it('should handle multiple fields', () => {
      const schema = {
        body: z.object({
          name: z.string().meta({ description: 'User name' }),
          email: z.email().meta({ description: 'User email' }),
          age: z.number().optional(),
          active: z.boolean().default(true)
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.name).toEqual({
        type: 'string',
        required: true,
        description: 'User name'
      })
      expect(result.body?.email).toEqual({
        type: 'string',
        required: true,
        description: 'User email'
      })
      expect(result.body?.age).toEqual({
        type: 'number',
        required: false,
        description: undefined
      })
      expect(result.body?.active).toEqual({
        type: 'boolean',
        required: false,
        description: undefined
      })
    })

    it('should handle coerced numbers with defaults', () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().default(0)
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.query?.page?.required).toBe(false)
    })

    it('should extract input type from transform/pipe schemas', () => {
      const schema = {
        body: z.object({
          value: z.string().transform((val) => parseInt(val, 10))
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.value?.type).toBe('string')
    })

    it('should extract input type from transform with optional', () => {
      const schema = {
        body: z.object({
          value: z.string().transform((val) => parseInt(val, 10)).optional()
        })
      }

      const result = extractParamsFromSchema(schema)

      expect(result.body?.value?.type).toBe('string')
      expect(result.body?.value?.required).toBe(false)
    })
  })
})
