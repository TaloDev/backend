import { EntityManager } from '@mikro-orm/mysql'
import jwt from 'jsonwebtoken'
import User from '../../entities/user.js'
import { differenceInDays } from 'date-fns'
import { Request, Response } from 'koa-clay'

export default async (req: Request, res: Response): Promise<void> => {
  const em: EntityManager = req.ctx.em
  const token: string = res.body.accessToken

  if (token) {
    const user = await em.getRepository(User).findOne(jwt.decode(token).sub)
    if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
      user.lastSeenAt = new Date()
      await em.flush()
    }
  }
}
