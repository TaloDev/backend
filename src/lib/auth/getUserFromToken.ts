import { EntityManager } from '@mikro-orm/core'
import { Context } from 'koa'
import User from '../../entities/user'

const getUserFromToken = async (ctx: Context, relations?: string[]): Promise<User> => {
  const userId: number = ctx.state.user.sub
  const user = await (<EntityManager>ctx.em).getRepository(User).findOne(userId, relations)
  return user
}

export default getUserFromToken