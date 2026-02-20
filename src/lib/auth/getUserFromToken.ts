import User from '../../entities/user'
import { ProtectedRouteContext } from '../routing/context'

export async function getUserFromToken(ctx: ProtectedRouteContext) {
  const em = ctx.em
  const userId = ctx.state.jwt.sub
  const user = await em.repo(User).findOneOrFail(userId, {
    populate: ['organisation.games'],
  })

  return user
}
