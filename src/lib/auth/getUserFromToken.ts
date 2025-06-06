import { EntityManager } from '@mikro-orm/mysql'
import { Context } from 'koa'
import User from '../../entities/user'

const getUserFromToken = async (ctx: Context, relations?: string[]): Promise<User> => {
  // user with email = loaded entity, user with sub = jwt
  if (ctx.state.user.email) {
    const user: User = ctx.state.user
    await (<EntityManager>ctx.em).getRepository(User).populate(user, relations as never[])
    return user
  }

  const userId: number = ctx.state.user.sub
  const user = await (<EntityManager>ctx.em).getRepository(User).findOneOrFail(userId, { populate: relations as never[] })
  return user
}

export default getUserFromToken
