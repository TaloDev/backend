import { extractParamsFromSchema, type ExtractedParam, type ExtractedParams } from './schema-introspector'
import type { ValidationSchema } from '../../middleware/validator-middleware'
import z from 'zod'
import { Middleware } from '../routing/router'
import { RouteState } from '../routing/state'

type ZodType = typeof z

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

type RouteSample = {
  title: string
  sample: Record<string, unknown>
}

export type RouteDocs = {
  key?: string
  description?: string
  samples?: RouteSample[]
}

type ParamLocation = 'query' | 'body' | 'headers' | 'route'

type ServiceDocsParam = {
  location: ParamLocation
  name: string
  required: boolean
  description?: string
  type?: ExtractedParam['type']
}

export type ServiceDocs = {
  name: string
  path: string
  routes: {
    method: HttpMethod
    path: string
    description?: string
    params: ServiceDocsParam[]
    samples?: RouteSample[]
    scopes?: string[]
  }[]
}

function extractScopesFromMiddleware<S extends RouteState>(middleware?: Middleware<S>[]) {
  for (const mw of (middleware ?? [])) {
    if (typeof mw === 'function' && 'scopes' in mw && Array.isArray(mw.scopes)) {
      return mw.scopes as string[]
    }
  }
}

export class DocsRegistry {
  private services: Map<string, ServiceDocs> = new Map()

  private flattenParams(extracted?: ExtractedParams) {
    const params: ServiceDocsParam[] = []

    const locations = ['body', 'query', 'route', 'headers'] as const
    for (const location of locations) {
      for (const [name, value] of Object.entries(extracted?.[location] ?? {})) {
        params.push({
          location,
          name,
          required: value.required,
          description: value.description,
          type: value.type
        })
      }
    }

    return params
  }

  addRoute<S extends RouteState>({
    key,
    method,
    path,
    schema,
    middleware,
    docs
  }: {
    key: string
    method: HttpMethod
    path: string
    schema?: (z: ZodType) => ValidationSchema
    middleware?: Middleware<S>[]
    docs?: RouteDocs
  }) {
    const service = this.services.get(key) ?? this.addService(key, path)

    const params = schema
      ? extractParamsFromSchema(schema(z))
      : undefined

    service.routes.push({
      method: method,
      path: path,
      description: docs?.description,
      params: this.flattenParams(params),
      samples: docs?.samples,
      scopes: extractScopesFromMiddleware(middleware)
    })
  }

  addService(name: string, path: string) {
    let service = this.services.get(name)

    if (!service) {
      service = {
        name,
        path,
        routes: []
      }
      this.services.set(name, service)
    } else {
      service.path = path
    }

    return service
  }

  toJSON() {
    return {
      services: Array.from(this.services.values())
    }
  }
}

if (!globalThis.talo) {
  globalThis.talo = {
    docs: new DocsRegistry()
  }
}
