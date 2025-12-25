import { Handler, Hono, MiddlewareHandler } from 'hono'
import { every } from 'hono/combine'
import { HttpMethod, RouteDocs } from '../docs/docs-registry'
import { APIRouteContext, BaseContext, ProtectedRouteContext, PublicRouteContext } from '../context'
import { contextMiddleware } from '../../middleware/context-middleware'

export type RouteHelpers<E extends BaseContext = BaseContext> = {
  route: (config: RouteConfig<E>) => void
}

export type RouteConfig<E extends BaseContext = BaseContext> = {
  method: HttpMethod
  path: string
  docs?: RouteDocs
  middleware?: MiddlewareHandler<E>[]
  handler: Handler<E>
}

export function mountRoute<E extends BaseContext = BaseContext>(
  app: Hono<E>,
  serviceName: string,
  basePath: string,
  config: RouteConfig<E>
) {
  const fullPath = `${basePath}${config.path}`
  const middleware = config.middleware ?? []
  const handler = config.handler

  switch (config.method) {
    case 'get':
      app.get(fullPath, every(...middleware), handler)
      break
    case 'post':
      app.post(fullPath, every(...middleware), handler)
      break
    case 'put':
      app.put(fullPath, every(...middleware), handler)
      break
    case 'patch':
      app.patch(fullPath, every(...middleware), handler)
      break
    case 'delete':
      app.delete(fullPath, every(...middleware), handler)
      break
  }

  if (config.docs) {
    globalThis.talo.docs.addRoute({
      serviceName,
      method: config.method,
      path: fullPath,
      docs: config.docs
    })
  }
}

function createRouter<E extends BaseContext = BaseContext>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<E>) => void
) {
  const app = new Hono<E>()
  app.use('*', contextMiddleware)

  globalThis.talo.docs.addService(serviceName, basePath)

  const helpers: RouteHelpers<E> = {
    route: (config) => {
      mountRoute(app, serviceName, basePath, config)
    }
  }

  builder(helpers)
  return app
}

export function publicRouter<E extends PublicRouteContext = PublicRouteContext>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<E>) => void
) {
  return createRouter<E>(serviceName, `/public${basePath}`, builder)
}

export function protectedRouter<E extends ProtectedRouteContext = ProtectedRouteContext>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<E>) => void
) {
  return createRouter<E>(serviceName, basePath, builder)
}

export function apiRouter<E extends APIRouteContext = APIRouteContext>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<E>) => void
) {
  return createRouter<E>(serviceName, `/v1${basePath}`, builder)
}

export function publicRoute(config: RouteConfig<PublicRouteContext>) {
  return config
}

export function protectedRoute(config: RouteConfig<ProtectedRouteContext>) {
  return config
}

export function apiRoute(config: RouteConfig<APIRouteContext>) {
  return config
}
