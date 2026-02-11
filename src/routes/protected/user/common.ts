import bcrypt from 'bcrypt'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export async function confirmPassword(ctx: ProtectedRouteContext, next: Next) {
  const { password } = ctx.request.body as { password: string }
  const user = ctx.state.user

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    ctx.throw(403, 'Incorrect password')
  }

  await next()
}

export async function requires2fa(ctx: ProtectedRouteContext, next: Next) {
  const user = ctx.state.user

  if (!user.twoFactorAuth?.enabled) {
    ctx.throw(403, 'Two factor authentication needs to be enabled')
  }

  await next()
}
