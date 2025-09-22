import { EntityManager } from '@mikro-orm/mysql'
import { Context } from 'koa'
import User from '../../entities/user'

async function getUserFromToken(ctx: Context) {
  const em: EntityManager = ctx.em

  // user with email = loaded entity, user with sub = jwt
  if (ctx.state.user.email) {
    return ctx.state.user as User
  }

  const userId: number = ctx.state.user.sub
  const user = await em.repo(User).findOneOrFail(userId)

  // populate after so the cache doesn't include from circular structures
  if (!user.organisation.games.isInitialized()) {
    await em.populate(user, ['organisation.games'])
  }

  return user
}

export default getUserFromToken
