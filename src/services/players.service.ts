import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate, HasPermission } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayersPolicy from '../policies/players.policy'
import Fuse from 'fuse.js'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'

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
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { aliases, gameId, props } = req.body
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

    if (props) {
      try {
        player.props = sanitiseProps(props)
      } catch (err) {
        req.ctx.throw(400, err.message)
      }
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
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, search } = req.query
    const em: EntityManager = req.ctx.em

    let players = await em.getRepository(Player).find({ game: Number(gameId) }, ['aliases'])

    if (search) {
      const items: SearchablePlayer[] = players.map((player) => ({
        id: player.id,
        allAliases: player.aliases.getItems().map((alias) => alias.identifier),
        allProps: player.props.map((prop) => prop.value)
      }))

      const fuse = new Fuse(items, { keys: ['id', 'allAliases', 'allProps'], threshold: 0.2 })
      players = fuse.search(search).map((fuseItem) => players[fuseItem.refIndex])
    }

    return {
      status: 200,
      body: {
        players
      }
    }
  }

  @Validate({
    body: {
      props: (val: unknown) => {
        if (val && !Array.isArray(val)) {
          return 'Props must be an array'
        }
      }
    }
  })
  @HasPermission(PlayersPolicy, 'patch')
  async patch(req: ServiceRequest): Promise<ServiceResponse> {
    const { props } = req.body
    const player: Player = req.ctx.state.player // set in the policy
  
    const em: EntityManager = req.ctx.em

    if (props) {
      const existingProps = player.props.filter((existingProp) => {
        return !props.find((incomingProp) => incomingProp.key === existingProp.key)
      })

      const propsSet = new Set([ ...existingProps, ...sanitiseProps(props) ])

      player.props = sanitiseProps([...propsSet], true)
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
