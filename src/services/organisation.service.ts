import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route } from 'koa-clay'
import Game from '../entities/game'
import Invite from '../entities/invite'
import Organisation from '../entities/organisation'
import User from '../entities/user'
import OrganisationPolicy from '../policies/organisation.policy'
import { TraceService } from '../lib/tracing/trace-service'

@TraceService()
export default class OrganisationService extends Service {
  @Route({
    method: 'GET',
    path: '/current'
  })
  @HasPermission(OrganisationPolicy, 'current')
  async current(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const organisation: Organisation = req.ctx.state.user.organisation

    const games = await em.getRepository(Game).find({
      organisation
    }, {
      populate: ['players']
    })

    const members = await em.getRepository(User).find({ organisation })

    const pendingInvites = await em.getRepository(Invite).find({ organisation })

    return {
      status: 200,
      body: {
        games,
        members,
        pendingInvites
      }
    }
  }
}
