import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
import HasPermission from '../lib/policies/hasPermission'
import PlayersPolicy from '../lib/policies/players.policy'
import PlayerResource from '../resources/player.resource'

export default class PlayersService implements Service {
  @Validate({
    body: ['gameId']
  })
  @HasPermission(PlayersPolicy, 'post')
  @Resource(PlayerResource, 'player')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { aliases, gameId } = req.body
    const em: EntityManager = req.ctx.em

    const player = new Player()
    player.aliases = aliases
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

  @Validate({
    query: ['gameId']
  })
  @HasPermission(PlayersPolicy, 'get')
  @Resource(PlayerResource, 'players')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const players = await em.getRepository(Player).find({ game: gameId })

    return {
      status: 200,
      body: {
        players
      }
    }
  }
}
