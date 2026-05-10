import User from '../../entities/user.js'
import { ProtectedRouteContext } from '../routing/context.js'

export async function getUserFromToken(ctx: ProtectedRouteContext) {
  const em = ctx.em
  const userId = ctx.state.jwt.sub
  const user = await em.repo(User).findOneOrFail(userId, {
    populate: ['organisation.games'],
  })

  return user
}
