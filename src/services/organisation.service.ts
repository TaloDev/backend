import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route } from 'koa-clay'
import Game from '../entities/game'
import Invite from '../entities/invite'
import Organisation from '../entities/organisation'
import User from '../entities/user'
import OrganisationPolicy from '../policies/organisation.policy'
import Player from '../entities/player'

export default class OrganisationService extends Service {
  @Route({
    method: 'GET',
    path: '/current'
  })
  @HasPermission(OrganisationPolicy, 'current')
  async current(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const organisation: Organisation = req.ctx.state.user.organisation

    const games = await em.repo(Game).find({ organisation })
    const playerCountMap: Map<number, number> = new Map()
    for (const game of games) {
      const playerCount = await em.repo(Player).count({ game })
      playerCountMap.set(game.id, playerCount)
    }

    const members = await em.repo(User).find({ organisation })
    const pendingInvites = await em.repo(Invite).find({ organisation })

    return {
      status: 200,
      body: {
        games: games.map((game) => ({
          ...game.toJSON(),
          playerCount: playerCountMap.get(game.id)
        })),
        members,
        pendingInvites
      }
    }
  }
}
