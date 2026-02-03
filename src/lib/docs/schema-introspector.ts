import type { ZodType } from 'zod'
import type { ValidationSchema } from '../../middleware/validator-middleware'
import assert from 'node:assert'

export type ExtractedParam = {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'unknown'
  required: boolean
  description?: string
}

export type ExtractedParams = {
  body?: Record<string, ExtractedParam>
  query?: Record<string, ExtractedParam>
  route?: Record<string, ExtractedParam>
  headers?: Record<string, ExtractedParam>
}

type UnwrapResult = {
  innerSchema: ZodType
  isOptional: boolean
  description?: string
}

type ZodInternals = {
  def: {
    type: string
    innerType?: ZodType
    shape?: Record<string, ZodType>
    format?: string
    in?: ZodType // input schema for pipe types (from .transform())
  }
}

type ZodTypeWithInternals = ZodType & { _zod: ZodInternals }

function getZodInternals(schema: ZodType) {
  return (schema as ZodTypeWithInternals)._zod satisfies ZodInternals
}

function unwrapSchema(schema: ZodType) {
  const description = schema.meta?.()?.description
  let isOptional = false
  let current = schema

  while (true) {
    const internals = getZodInternals(current)
    const type = internals.def.type

    if (['optional', 'nullable', 'default', 'prefault'].includes(type)) {
      isOptional = true

      const inner = internals.def.innerType
      assert(inner)
      current = inner
    } else {
      break
    }
  }

  return { innerSchema: current, isOptional, description } satisfies UnwrapResult
}

const knownTypes = ['string', 'number', 'boolean', 'array', 'object', 'enum'] as const

function getSchemaType(schema: ZodType): ExtractedParam['type'] {
  const internals = getZodInternals(schema)
  const type = internals.def.type

  if (knownTypes.includes(type as typeof knownTypes[number])) {
    return type as ExtractedParam['type']
  }

  // catches string format types like uuid, email, etc
  if (internals.def.format) {
    return 'string'
  }

  // pipe types are created by .transform() - extract input type for docs
  if (type === 'pipe' && internals.def.in) {
    return getSchemaType(internals.def.in)
  }

  return 'unknown'
}

function extractParamInfo(schema: ZodType) {
  const { innerSchema, isOptional, description } = unwrapSchema(schema)

  return {
    type: getSchemaType(innerSchema),
    required: !isOptional,
    description
  } satisfies ExtractedParam
}

function extractObjectProperties(objectSchema: ZodType) {
  const result: Record<string, ExtractedParam> = {}
  const internals = getZodInternals(objectSchema)

  const shape = internals.def.shape
  if (shape) {
    for (const [key, propSchema] of Object.entries(shape)) {
      result[key] = extractParamInfo(propSchema)
    }
  }

  return result
}

export function extractParamsFromSchema(schema: ValidationSchema) {
  const result: ExtractedParams = {}

  if (schema.body) {
    result.body = extractObjectProperties(schema.body)
  }

  if (schema.query) {
    result.query = extractObjectProperties(schema.query)
  }

  if (schema.route) {
    result.route = extractObjectProperties(schema.route)
  }

  if (schema.headers) {
    result.headers = extractObjectProperties(schema.headers)
  }

  return result
}
