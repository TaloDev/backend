import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate, HasPermission } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
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

    const game = await em.getRepository(Game).findOne(gameId)

    const player = new Player(game)
    player.aliases = aliases
    player.props = {}

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

    const players = await em.getRepository(Player).find({ game: Number(gameId) })

    return {
      status: 200,
      body: {
        players
      }
    }
  }
}
