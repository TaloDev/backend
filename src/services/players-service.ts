import { EntityManager, expr } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import Player, { PlayerPrivacyScope } from '../entities/player'
import PlayerResource from '../resources/player-resource'

export const routes: ServiceRoute[] = [
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify'
  },
  {
    method: 'POST'
  }
]

export default class PlayersService implements Service {
  @Validate({
    query: {
      alias: 'Please provide a player alias provider (e.g. Steam)',
      id: 'Please provide an ID for the given alias'
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
      gameId: async (val: number, req: ServiceRequest) => {
        const em: EntityManager = req.ctx.em
        const game = await em.getRepository(Game).findOne(val)
        if (!game) return 'The specified game doesn\'t exist'
      }
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
    await em.persistAndFlush(player)

    console.log(player)

    return {
      status: 200,
      body: {
        player
      }
    }
  }
}
