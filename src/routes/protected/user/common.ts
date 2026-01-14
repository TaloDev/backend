import bcrypt from 'bcrypt'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export const confirmPassword = async (ctx: ProtectedRouteContext, next: Next) => {
  const { password } = ctx.request.body as { password: string }
  const user = ctx.state.authenticatedUser

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    ctx.throw(403, 'Incorrect password')
  }

  await next()
}

export const requires2fa = async (ctx: ProtectedRouteContext, next: Next) => {
  const user = ctx.state.authenticatedUser

  if (!user.twoFactorAuth?.enabled) {
    ctx.throw(403, 'Two factor authentication needs to be enabled')
  }

  await next()
}
