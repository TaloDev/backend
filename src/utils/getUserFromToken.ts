import { EntityManager } from '@mikro-orm/core'
import { Context } from 'koa'
import User from '../entities/user'

export default async (ctx: Context) => {
  const userId: number = ctx.state.user.sub
  const user = await (<EntityManager>ctx.em).getRepository(User).findOne(userId)
  return user
}
