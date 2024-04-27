import { EntityManager } from '@mikro-orm/mysql'
import { Service, Request, Response } from 'koa-clay'
import Invite from '../../entities/invite'

export default class InvitePublicService extends Service {
  async get(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em

    const invite = await em.getRepository(Invite).findOne({ token: id }, { populate: ['organisation'] })
    if (!invite) req.ctx.throw(404, 'Invite not found')

    return {
      status: 200,
      body: {
        invite
      }
    }
  }
}
