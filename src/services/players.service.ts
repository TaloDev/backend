import { EntityManager, FilterQuery } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate, HasPermission, ServiceRoute } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayersPolicy from '../policies/players.policy'
import Fuse from 'fuse.js'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'
import Event from '../entities/event'

export const playersRoutes: ServiceRoute[] = [
  {
    method: 'POST'
  },
  {
    method: 'GET'
  },
  {
    method: 'PATCH'
  },
  {
    method: 'GET',
    path: '/:id/events',
    handler: 'events'
  }
]

interface SearchablePlayer {
  id: string
  allAliases: string[]
  allProps: string[]
}

const itemsPerPage = 25

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
    const { gameId, search, page } = req.query
    const em: EntityManager = req.ctx.em

    const whereOptions: FilterQuery<Player> = {
      game: Number(gameId)
    }

    // TODO, construct whereOptions from search string like "prop:52 alias:3423423"

    let [players, count] = await em.getRepository(Player).findAndCount(
      whereOptions,
      {
        populate: ['aliases'],
        limit: itemsPerPage,
        offset: Number(page) * itemsPerPage
      }
    )

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
        players,
        count
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

  @HasPermission(PlayersPolicy, 'getEvents')
  async events(req: ServiceRequest): Promise<ServiceResponse> {
    const { search, page } = req.query
    const em: EntityManager = req.ctx.em
    const player: Player = req.ctx.state.player // set in the policy

    // TODO, construct whereOptions from search string like "prop:52 alias:3423423"

    let [events, count] = await em.getRepository(Event).findAndCount({
      playerAlias: player.aliases.getItems()
    }, {
      limit: itemsPerPage,
      offset: Number(page) * itemsPerPage
    })

    if (search) {
      const fuse = new Fuse(events, { keys: ['name'], threshold: 0.2 })
      events = fuse.search(search).map((fuseItem) => events[fuseItem.refIndex])
    }

    // TODO, don't need this yet but useful bit of code for later
    // const propColumns = events.reduce((acc: string[], curr: Event): string[] => {
    //   const allKeys: string[] = curr.props.map((prop: Prop) => prop.key)
    //   return [...new Set([...acc, ...allKeys])]
    // }, [])

    return {
      status: 200,
      body: {
        events,
        count
      }
    }
  }
}
