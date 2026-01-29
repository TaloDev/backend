export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

type RouteSample = {
  title: string
  sample: Record<string, unknown>
}

type RouteParamConfig = {
  required?: boolean
  description: string
}

type RouteParams = {
  query?: Record<string, RouteParamConfig>
  body?: Record<string, RouteParamConfig>
  headers?: Record<string, RouteParamConfig>
  route?: Record<string, RouteParamConfig>
}

export type RouteDocs = {
  key?: string
  description?: string
  params?: RouteParams
  samples?: RouteSample[]
  scopes?: string[]
}

type ParamType = keyof RouteParams
type ServiceDocsParam = {
  type: ParamType
  name: string
  required: boolean
  description?: string
}

export type ServiceDocs = {
  name: string
  path: string
  routes: {
    method: HttpMethod
    path: string
    description?: string
    params?: ServiceDocsParam[]
    samples?: RouteSample[]
    scopes?: string[]
  }[]
}

export class DocsRegistry {
  private services: Map<string, ServiceDocs> = new Map()

  private flattenParams(params: RouteParams | undefined) {
    const flattenedParams: ServiceDocsParam[] = []
    for (const [paramType, paramObj] of Object.entries(params ?? {})) {
      for (const [name, value] of Object.entries(paramObj)) {
        const { required, description } = value

        flattenedParams.push({
          type: paramType as ParamType,
          name,
          required: required ?? paramType === 'route',
          description
        })
      }
    }
    return flattenedParams
  }

  addRoute(config: {
    key: string
    method: HttpMethod
    path: string
    docs?: RouteDocs
  }) {
    const service = this.services.get(config.key) ?? this.addService(config.key, config.path)

    service.routes.push({
      method: config.method,
      path: config.path,
      description: config.docs?.description,
      params: this.flattenParams(config.docs?.params),
      samples: config.docs?.samples,
      scopes: config.docs?.scopes
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
