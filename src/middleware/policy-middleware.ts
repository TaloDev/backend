import type Koa from 'koa'
import { AdminAPIKeyScope } from '../entities/admin-api-key.js'
import { APIKeyScope } from '../entities/api-key.js'
import { UserType } from '../entities/user.js'
import {
  AdminAPIRouteContext,
  APIRouteContext,
  ProtectedRouteContext,
} from '../lib/routing/context.js'
import { Middleware } from '../lib/routing/router.js'
import { AdminAPIRouteState, APIRouteState, ProtectedRouteState } from '../lib/routing/state.js'
import checkScope from '../policies/checkScope.js'

type RequireScopesMiddleware = Middleware<APIRouteState> & {
  readonly scopes: APIKeyScope[]
}

type RequireAdminScopesMiddleware = Middleware<AdminAPIRouteState> & {
  readonly scopes: AdminAPIKeyScope[]
}

export function requireScopes(scopes: APIKeyScope[]): RequireScopesMiddleware {
  const requireScopes = async (ctx: APIRouteContext, next: Koa.Next) => {
    const key = ctx.state.key
    const missing = scopes.filter((scope) => !checkScope(key, scope))

    if (missing.length > 0) {
      ctx.status = 403
      ctx.body = {
        message: `Missing API key scope(s): ${missing.join(', ')}`,
      }
      return
    }

    await next()
  }

  return Object.assign(requireScopes, { scopes })
}

export function userTypeGate(types: UserType[], action: string): Middleware<ProtectedRouteState> {
  const userTypeGate = async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    const user = ctx.state.user

    if (user.type !== UserType.OWNER && !types.includes(user.type)) {
      ctx.status = 403
      ctx.body = {
        message: `You do not have permissions to ${action}`,
      }
      return
    }

    await next()
  }

  return userTypeGate
}

export function ownerGate(action: string): Middleware<ProtectedRouteState> {
  const ownerGate = async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    const user = ctx.state.user

    if (user.type !== UserType.OWNER) {
      ctx.status = 403
      ctx.body = {
        message: `You do not have permissions to ${action}`,
      }
      return
    }

    await next()
  }

  return ownerGate
}

export function requireEmailConfirmed(action: string): Middleware<ProtectedRouteState> {
  const requireEmailConfirmed = async (ctx: ProtectedRouteContext, next: Koa.Next) => {
    const user = ctx.state.user

    if (!user.emailConfirmed) {
      ctx.status = 403
      ctx.body = {
        message: `You need to confirm your email address to ${action}`,
      }
      return
    }

    await next()
  }

  return requireEmailConfirmed
}

export function requireAdminScopes(scopes: AdminAPIKeyScope[]): RequireAdminScopesMiddleware {
  const requireAdminScopes = async (ctx: AdminAPIRouteContext, next: Koa.Next) => {
    const key = ctx.state.key
    const missing = scopes.filter(
      (scope) => !key.scopes.includes(AdminAPIKeyScope.FULL_ACCESS) && !key.scopes.includes(scope),
    )

    if (missing.length > 0) {
      ctx.status = 403
      ctx.body = { message: `Missing admin API key scope(s): ${missing.join(', ')}` }
      return
    }

    await next()
  }

  return Object.assign(requireAdminScopes, { scopes })
}
