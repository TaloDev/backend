import Router from 'koa-tree-router'
import type Koa from 'koa'
import { HttpMethod, RouteDocs } from '../docs/docs-registry'
import { APIRouteState, AppParameterizedContext, ProtectedRouteState, PublicRouteState } from '../context'
import type { ValidationSchema, ValidatedContext } from '../../middleware/validator-middleware'
import { validate } from '../../middleware/validator-middleware'
import { z } from 'zod'

type Handler<S = PublicRouteState> = (
  ctx: AppParameterizedContext<S>
) => void | Promise<void>

type ValidatedHandler<
  V extends ValidationSchema,
  S = PublicRouteState
> = (
  ctx: ValidatedContext<V, S>
) => void | Promise<void>

export type Middleware<S = PublicRouteState> = (
  ctx: AppParameterizedContext<S>,
  next: Koa.Next
) => Promise<void> | void

type RouteHelpers<S = PublicRouteState> = {
  route: <V extends ValidationSchema | undefined = undefined>(config: RouteConfig<S, V>) => void
}

type ZodBuilder = typeof z

export type ValidatedRouteConfig<
  S = PublicRouteState,
  V extends ValidationSchema = ValidationSchema
> = {
  method: HttpMethod
  path: string
  docs?: RouteDocs
  middleware?: Middleware<S>[]
  schema: (z: ZodBuilder) => V
  handler: ValidatedHandler<V, S>
}

export type UnvalidatedRouteConfig<S = PublicRouteState> = {
  method: HttpMethod
  path: string
  docs?: RouteDocs
  middleware?: Middleware<S>[]
  schema?: never
  handler: Handler<S>
}

type RouteConfig<
  S = PublicRouteState,
  V extends ValidationSchema | undefined = undefined
> = V extends ValidationSchema
  ? ValidatedRouteConfig<S, V>
  : UnvalidatedRouteConfig<S>

function mountRoute<S = PublicRouteState, V extends ValidationSchema | undefined = undefined>(
  router: Router,
  serviceName: string,
  basePath: string,
  config: RouteConfig<S, V>
) {
  const fullPath = `${basePath}${config.path}`
  const middleware = config.middleware ?? []
  const handler = config.handler

  // koa doesn't handle generics very well
  const allMiddleware = ('schema' in config && config.schema
    ? [...middleware, validate(config.schema(z)), handler]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : [...middleware, handler]) as any[]

  switch (config.method) {
    case 'get':
      router.get(fullPath, ...allMiddleware)
      break
    case 'post':
      router.post(fullPath, ...allMiddleware)
      break
    case 'put':
      router.put(fullPath, ...allMiddleware)
      break
    case 'patch':
      router.patch(fullPath, ...allMiddleware)
      break
    case 'delete':
      router.delete(fullPath, ...allMiddleware)
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

function createRouter<S = PublicRouteState>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  const router = new Router()

  globalThis.talo.docs.addService(serviceName, basePath)

  const helpers: RouteHelpers<S> = {
    route: (config) => {
      mountRoute(router, serviceName, basePath, config)
    }
  }

  builder(helpers)
  return router
}

export function publicRouter<S extends PublicRouteState = PublicRouteState>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  return createRouter<S>(serviceName, basePath, builder)
}

export function protectedRouter<S extends ProtectedRouteState = ProtectedRouteState>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  return createRouter<S>(serviceName, basePath, builder)
}

export function apiRouter<S extends APIRouteState = APIRouteState>(
  serviceName: string,
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  return createRouter<S>(serviceName, basePath, builder)
}

export function publicRoute<V extends ValidationSchema>(
  config: ValidatedRouteConfig<PublicRouteState, V>
): ValidatedRouteConfig<PublicRouteState, V>
export function publicRoute(
  config: UnvalidatedRouteConfig<PublicRouteState>
): UnvalidatedRouteConfig<PublicRouteState>
// implementation signature required for overloads
export function publicRoute(config: unknown) {
  return config
}

export function protectedRoute<V extends ValidationSchema>(
  config: ValidatedRouteConfig<ProtectedRouteState, V>
): ValidatedRouteConfig<ProtectedRouteState, V>
export function protectedRoute(
  config: UnvalidatedRouteConfig<ProtectedRouteState>
): UnvalidatedRouteConfig<ProtectedRouteState>
// implementation signature required for overloads
export function protectedRoute(config: unknown) {
  return config
}

export function apiRoute<V extends ValidationSchema>(
  config: ValidatedRouteConfig<APIRouteState, V>
): ValidatedRouteConfig<APIRouteState, V>
export function apiRoute(
  config: UnvalidatedRouteConfig<APIRouteState>
): UnvalidatedRouteConfig<APIRouteState>
// implementation signature required for overloads
export function apiRoute(config: unknown) {
  return config
}
