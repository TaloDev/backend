import type Koa from 'koa'
import { APIKeyScope } from '../entities/api-key'
import { UserType } from '../entities/user'
import checkScope from '../policies/checkScope'
import { Middleware } from '../lib/routing/router'
import { APIRouteContext, ProtectedRouteContext } from '../lib/routing/context'
import { APIRouteState, ProtectedRouteState } from '../lib/routing/state'

export type RequireScopesMiddleware = Middleware<APIRouteState> & {
  readonly scopes: APIKeyScope[]
}

export function requireScopes(scopes: APIKeyScope[]): RequireScopesMiddleware {
  const middleware = async (ctx: APIRouteContext, next: Koa.Next) => {
    const key = ctx.state.key
    if (!key) {
      ctx.status = 401
      ctx.body = {}
      return
    }

    const missing = scopes.filter((scope) => !checkScope(key, scope))

    if (missing.length > 0) {
      ctx.status = 403
      ctx.body = {
        message: `Missing access key scope(s): ${missing.join(', ')}`
      }
      return
    }

    await next()
  }

  return Object.assign(middleware, { scopes })
}

export function userTypeGate(types: UserType[], action: string): Middleware<ProtectedRouteState> {
  return async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    if (ctx.state.jwt.api) {
      await next()
      return
    }

    const user = ctx.state.user

    if (!user) {
      ctx.status = 401
      return
    }

    if (user.type !== UserType.OWNER && !types.includes(user.type)) {
      ctx.status = 403
      ctx.body = {
        message: `You do not have permissions to ${action}`
      }
      return
    }

    await next()
  }
}

export function ownerGate(action: string): Middleware<ProtectedRouteState> {
  return async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    if (ctx.state.jwt.api) {
      await next()
      return
    }

    const user = ctx.state.user

    if (!user) {
      ctx.status = 401
      return
    }

    if (user.type !== UserType.OWNER) {
      ctx.status = 403
      ctx.body = {
        message: `You do not have permissions to ${action}`
      }
      return
    }

    await next()
  }
}

export function requireEmailConfirmed(action: string): Middleware<ProtectedRouteState> {
  return async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    const user = ctx.state.user

    if (!user) {
      ctx.status = 401
      ctx.body = {}
      return
    }

    if (ctx.state.jwt.api) {
      await next()
      return
    }

    if (!user.emailConfirmed) {
      ctx.status = 403
      ctx.body = {
        message: `You need to confirm your email address to ${action}`
      }
      return
    }

    await next()
  }
}
