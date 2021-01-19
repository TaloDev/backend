import { EntityManager } from '@mikro-orm/core'
import jwt from 'jsonwebtoken'
import { HookParams, ServiceRequest } from 'koa-rest-services'
import User from '../entities/user'
import differenceInDays from 'date-fns/differenceInDays'

export default async (hook: HookParams): Promise<void> => {
  if (hook.result.status === 200) {
    const [req] = hook.args
    const em: EntityManager = (<ServiceRequest>req).ctx.em
    const token: string = hook.result.body.accessToken
    const userId = jwt.decode(token).sub
      
    const user = await em.getRepository(User).findOne(userId)
    if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
      user.lastSeenAt = new Date()
      await em.flush() 
    }
  }
}