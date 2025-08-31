import { EntityManager } from '@mikro-orm/mysql'
import { Context } from 'koa'
import User from '../../entities/user'
import { getResultCacheOptions } from '../perf/getResultCacheOptions'

async function getUserFromToken(ctx: Context) {
  const em: EntityManager = ctx.em

  // user with email = loaded entity, user with sub = jwt
  if (ctx.state.user.email) {
    return ctx.state.user as User
  }

  const userId: number = ctx.state.user.sub
  const user = await em.repo(User).findOneOrFail(
    userId,
    getResultCacheOptions(`user-from-token-${userId}-${ctx.state.user.iat}`)
  )
  return user
}

export default getUserFromToken
