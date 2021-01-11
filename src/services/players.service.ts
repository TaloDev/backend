import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import Player, { PlayerPrivacyScope } from '../entities/player'
import PlayerResource from '../resources/player.resource'

export default class PlayersService implements Service {
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
