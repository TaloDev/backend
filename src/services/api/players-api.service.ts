import { EntityManager, expr } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import Game from '../../entities/game'
import Player, { PlayerPrivacyScope } from '../../entities/player'
import PlayerResource from '../../resources/player.resource'

export const playerAPIRoutes: ServiceRoute[] = [
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify'
  },
  {
    method: 'POST'
  }
]

export default class PlayersAPIService implements Service {
  @Validate({
    query: {
      alias: 'Missing query parameter: alias',
      id: 'Missing query parameter: id'
    }
  })
  @Resource(PlayerResource, 'player')
  async identify(req: ServiceRequest): Promise<ServiceResponse> {
    const { alias, id } = req.query
    const em: EntityManager = req.ctx.em

    const player = await em.getRepository(Player).findOne({
      [expr(`json_extract(aliases, '$.${alias}')`)]: id
    })

    if (!player) {
      req.ctx.throw(404, 'User not found')
    }

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @Validate({
    body: {
      privacyScope: (val: number) => {
        if (val !== undefined && !(val in PlayerPrivacyScope)) {
          return 'Invalid privacy scope'
        }
      },
      gameId: 'Missing body parameter: gameId'
    }
  })
  @Resource(PlayerResource, 'player')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { aliases, privacyScope, gameId } = req.body
    const em: EntityManager = req.ctx.em

    const player = new Player()
    player.aliases = aliases
    player.privacyScope = privacyScope ?? PlayerPrivacyScope.ANONYMOUS
    player.game = await em.getRepository(Game).findOne(gameId)

    if (!player.game) {
      req.ctx.throw(400, 'The specified game doesn\'t exist')
    }

    await em.persistAndFlush(player)

    return {
      status: 200,
      body: {
        player
      }
    }
  }
}
