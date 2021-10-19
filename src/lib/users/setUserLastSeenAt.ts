import { EntityManager } from '@mikro-orm/core'
import jwt from 'jsonwebtoken'
import { HookParams } from 'koa-rest-services'
import User from '../../entities/user'
import { differenceInDays } from 'date-fns'

export default async (hook: HookParams): Promise<void> => {
  const em: EntityManager = hook.req.ctx.em
  const token: string = hook.result.body.accessToken
  const userId = jwt.decode(token).sub

  const user = await em.getRepository(User).findOne(userId)
  if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
    user.lastSeenAt = new Date()
    await em.flush()
  }
}
