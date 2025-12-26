import type Koa from 'koa'
import { APIKeyScope } from '../entities/api-key'
import { UserType } from '../entities/user'
import checkScope from '../policies/checkScope'
import { Middleware } from '../lib/routing/router'
import { APIRouteState, AppParameterizedContext, ProtectedRouteState } from '../lib/context'

export function requireScopes(scopes: APIKeyScope[]): Middleware<APIRouteState> {
  return async (ctx: AppParameterizedContext<APIRouteState>, next: Koa.Next) => {
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
}

export function userTypeGate(types: UserType[], action: string): Middleware<ProtectedRouteState> {
  return async (ctx: AppParameterizedContext<ProtectedRouteState>, next: Koa.Next) => {
    if ((ctx.state.user as { api?: boolean }).api) {
      await next()
      return
    }

    const user = ctx.state.user

    if (!user) {
      ctx.status = 401
      ctx.body = {}
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

export function requireEmailConfirmed(action: string): Middleware<ProtectedRouteState> {
  return async (ctx: AppParameterizedContext<ProtectedRouteState>, next: Koa.Next) => {
    const user = ctx.state.user

    if (!user) {
      ctx.status = 401
      ctx.body = {}
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
