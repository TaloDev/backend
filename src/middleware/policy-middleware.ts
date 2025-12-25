import { APIKeyScope } from '../entities/api-key'
import { UserType } from '../entities/user'
import checkScope from '../policies/checkScope'
import { createMiddleware } from 'hono/factory'

export function requireScopes(scopes: APIKeyScope[]) {
  return createMiddleware(async (c, next) => {
    const key = c.get('key')
    if (!key) {
      return c.json({}, 401)
    }

    const missing = scopes.filter((scope) => !checkScope(key, scope))

    if (missing.length > 0) {
      return c.json({
        message: `Missing access key scope(s): ${missing.join(', ')}`
      }, 403)
    }

    await next()
  })
}

export function userTypeGate(types: UserType[], action: string) {
  return createMiddleware(async (c, next) => {
    if (c.get('user')?.api) {
      await next()
      return
    }

    const user = c.get('user')

    if (!user) {
      return c.json({}, 401)
    }

    if (user.type !== UserType.OWNER && !types.includes(user.type)) {
      return c.json({
        message: `You do not have permissions to ${action}`
      }, 403)
    }

    await next()
  })
}

export function requireEmailConfirmed(action: string) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json({}, 401)
    }

    if (!user.emailConfirmed) {
      return c.json({
        message: `You need to confirm your email address to ${action}`
      }, 403)
    }

    await next()
  })
}
