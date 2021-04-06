import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate, HasPermission } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayersPolicy from '../policies/players.policy'
import PlayerResource from '../resources/player.resource'
import Fuse from 'fuse.js'
import PlayerAlias from '../entities/player-alias'

interface SearchablePlayer {
  id: string
  allAliases: string[]
  allProps: string[]
}

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
    if (aliases) {
      player.aliases = aliases.map((item) => {
        const alias = new PlayerAlias()
        alias.service = item.service
        alias.identifier = item.identifier
        return alias
      })
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
    const { gameId, search } = req.query
    const em: EntityManager = req.ctx.em
    let players = await em.getRepository(Player).find({ game: Number(gameId) })

    if (search) {
      const items: SearchablePlayer[] = players.map((player) => ({
        id: player.id,
        allAliases: Object.keys(player.aliases).map((key) => player.aliases[key]),
        allProps: Object.keys(player.props).map((key) => player.props[key])
      }))

      const fuse = new Fuse(items, { keys: ['id', 'allAliases', 'allProps'] })
      players = fuse.search(search).map((fuseItem) => players[fuseItem.refIndex])
    }

    return {
      status: 200,
      body: {
        players
      }
    }
  }

  @HasPermission(PlayersPolicy, 'patch')
  @Resource(PlayerResource, 'player')
  async patch(req: ServiceRequest): Promise<ServiceResponse> {
    const { props } = req.body
    const em: EntityManager = req.ctx.em

    const player = req.ctx.state.player // set in the policy
    player.props = {
      ...player.props,
      ...props
    }

    for (let key in player.props) {
      if (player.props[key] === null) {
        delete player.props[key]
      }
    }

    await em.flush()

    return {
      status: 200,
      body: {
        player
      }
    }
  }
}
