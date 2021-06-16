import { Service, ServiceRequest, ServiceResponse, Validate, HasPermission, ServiceRoute } from 'koa-rest-services'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayersPolicy from '../policies/players.policy'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'
import Event from '../entities/event'
import { EntityManager } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/core'

const itemsPerPage = 25

export default class PlayersService implements Service {
  routes: ServiceRoute[] = [
    {
      method: 'POST'
    },
    {
      method: 'GET',
      handler: 'index'
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
  @HasPermission(PlayersPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, search, page } = req.query
    const em: EntityManager = req.ctx.em

    let baseQuery = em.createQueryBuilder(Player, 'p')  

    if (search) {
      baseQuery = baseQuery
        .where('json_extract(props, \'$[*].value\') like ?', [`%${search}%`])
        .orWhere({
          aliases: {
            identifier: {
              $like: `%${search}%`
            }
          }
        })
        .orWhere({
          id: {
            $like: `%${search}%`
          }
        })
    }

    baseQuery = baseQuery.andWhere({ game: Number(gameId) })

    const { count } = await baseQuery
      .count('p.id', true)
      .execute('get')

    const players = await baseQuery
      .select('p.*', true)
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)
      .getResultList()

    await em.populate(players, 'aliases')

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

    let baseQuery = em.createQueryBuilder(Event, 'e')

    if (search) {
      baseQuery = baseQuery
        .where('json_extract(props, \'$[*].value\') like ?', [`%${search}%`])
        .orWhere({
          name: {
            $like: `%${search}%`
          }
        })
    }

    baseQuery = baseQuery.andWhere({
      playerAlias: {
        player
      }
    })

    const { count } = await baseQuery
      .count('e.id', true)
      .execute('get')

    const events = await baseQuery
      .select('e.*', true)
      .orderBy({
        createdAt: QueryOrder.DESC
      })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)
      .getResultList()

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
