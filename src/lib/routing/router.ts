import Router from 'koa-tree-router'
import type Koa from 'koa'
import { HttpMethod, RouteDocs } from '../docs/docs-registry'
import type { AppParameterizedContext } from './context'
import type { ValidationSchema, ValidatedContext } from '../../middleware/validator-middleware'
import { validate } from '../../middleware/validator-middleware'
import { z } from 'zod'
import { APIRouteState, ProtectedRouteState, PublicRouteState, RouteState } from './state'

type HandlerResponse = {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

type Handler<S extends RouteState> = (
  ctx: AppParameterizedContext<S>
) => HandlerResponse | Promise<HandlerResponse>

type ValidatedHandler<
  V extends ValidationSchema,
  S extends RouteState
> = (
  ctx: ValidatedContext<V, S>
) => HandlerResponse | Promise<HandlerResponse>

export type Middleware<S extends RouteState> = (
  ctx: AppParameterizedContext<S>,
  next: Koa.Next
) => Promise<void> | void

export function withMiddleware<S extends RouteState>(
  ...middleware: Middleware<S>[]
) {
  return middleware
}

type RouteHelpers<S extends RouteState> = {
  route: <RS extends S = S, V extends ValidationSchema | undefined = undefined>(config: RouteConfig<RS, V>) => void
}

type ZodBuilder = typeof z

// used to ensure we only pass in the schema properties
// while keeping type inference
type Exact<T, Shape> = {
  [K in keyof T]: K extends keyof Shape ? T[K] : never
}

export type ValidatedRouteConfig<
  S extends RouteState,
  V extends ValidationSchema = ValidationSchema
> = {
  method: HttpMethod
  path?: string
  docs?: RouteDocs
  middleware?: Middleware<S>[]
  schema: (z: ZodBuilder) => V & Exact<V, ValidationSchema>
  handler: ValidatedHandler<V, S>
}

export type UnvalidatedRouteConfig<S extends RouteState> = {
  method: HttpMethod
  path?: string
  docs?: RouteDocs
  middleware?: Middleware<S>[]
  schema?: never
  handler: Handler<S>
}

type RouteConfig<
  S extends RouteState,
  V extends ValidationSchema | undefined = undefined
> = V extends ValidationSchema
  ? ValidatedRouteConfig<S, V>
  : UnvalidatedRouteConfig<S>

function mountRoute<S extends RouteState, V extends ValidationSchema | undefined = undefined>(
  router: Router,
  basePath: string,
  config: RouteConfig<S, V>,
  docsKey?: string
) {
  const fullPath = `${basePath}${config.path ?? ''}`
  const middleware = config.middleware ?? []

  const applyResponse = (ctx: AppParameterizedContext<S>, response: HandlerResponse) => {
    ctx.status = response.status
    if (response.body) {
      ctx.body = response.body
    }
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        ctx.set(key, value)
      }
    }
  }

  const allMiddleware = ('schema' in config && config.schema
    ? [
      ...middleware,
      validate(config.schema(z)),
      async (ctx: ValidatedContext<V extends ValidationSchema ? V : never, S>) => {
        const response = await (config as ValidatedRouteConfig<S, V extends ValidationSchema ? V : never>).handler(ctx)
        applyResponse(ctx, response)
      }
    ]
    : [
      ...middleware,
      async (ctx: AppParameterizedContext<S>) => {
        const response = await (config as UnvalidatedRouteConfig<S>).handler(ctx)
        applyResponse(ctx, response)
      }
    // koa doesn't handle generic context very well
    ]) as unknown as Router.Middleware[]

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

  const key = config.docs?.key ?? docsKey
  if (key) {
    globalThis.talo.docs.addRoute({
      key,
      method: config.method,
      path: fullPath,
      schema: config.schema,
      middleware,
      docs: config.docs
    })
  }
}

function createRouter<S extends RouteState>(
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void,
  docsKey?: string
): Router {
  const router = new Router()

  const helpers: RouteHelpers<S> = {
    route: <RS extends S = S, V extends ValidationSchema | undefined = undefined>(config: RouteConfig<RS, V>) => {
      mountRoute(router, basePath, config, docsKey)
    }
  }

  builder(helpers)
  return router
}

export function publicRouter<S extends PublicRouteState = PublicRouteState>(
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  return createRouter<S>(basePath, builder)
}

export function protectedRouter<S extends ProtectedRouteState = ProtectedRouteState>(
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void
): Router {
  return createRouter<S>(basePath, builder)
}

export function apiRouter<S extends APIRouteState = APIRouteState>(
  basePath: string,
  builder: (helpers: RouteHelpers<S>) => void,
  opts: {
    docsKey?: string
  } = {}
): Router {
  return createRouter<S>(basePath, builder, opts.docsKey)
}

// validated route
export function publicRoute<S extends PublicRouteState, V extends ValidationSchema>(
  config: ValidatedRouteConfig<S, V>
): ValidatedRouteConfig<S, V>
// unvalidated route
export function publicRoute<S extends PublicRouteState>(
  config: UnvalidatedRouteConfig<S>
): UnvalidatedRouteConfig<S>
// implementation signature required for overloads
export function publicRoute(config: unknown) {
  return config
}

// validated route
export function protectedRoute<S extends ProtectedRouteState = ProtectedRouteState, V extends ValidationSchema = ValidationSchema>(
  config: ValidatedRouteConfig<S, V>
): ValidatedRouteConfig<S, V>
// unvalidated route
export function protectedRoute<S extends ProtectedRouteState = ProtectedRouteState>(
  config: UnvalidatedRouteConfig<S>
): UnvalidatedRouteConfig<S>
// implementation signature required for overloads
export function protectedRoute(config: unknown) {
  return config
}

// validated route
export function apiRoute<S extends APIRouteState = APIRouteState, V extends ValidationSchema = ValidationSchema>(
  config: ValidatedRouteConfig<S, V>
): ValidatedRouteConfig<S, V>
// unvalidated route
export function apiRoute<S extends APIRouteState = APIRouteState>(
  config: UnvalidatedRouteConfig<S>
): UnvalidatedRouteConfig<S>
// implementation signature required for overloads
export function apiRoute(config: unknown) {
  return config
}
