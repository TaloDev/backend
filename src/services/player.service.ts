import { Service, Request, Response, Validate, HasPermission, Routes, ValidationCondition } from 'koa-clay'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayerPolicy from '../policies/player.policy'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'
import Event from '../entities/event'
import { EntityManager } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/core'
import uniqWith from 'lodash.uniqwith'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'

const itemsPerPage = 25

@Routes([
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
])
export default class PlayerService implements Service {
  @Validate({
    body: ['gameId']
  })
  @HasPermission(PlayerPolicy, 'post')
  async post(req: Request): Promise<Response> {
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
  @HasPermission(PlayerPolicy, 'index')
  async index(req: Request): Promise<Response> {
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

    await em.populate(players, ['aliases'])

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
      props: {
        required: true,
        validation: async (val: unknown): Promise<ValidationCondition[]> => [
          {
            check: Array.isArray(val),
            error: 'Props must be an array'
          }
        ]
      }
    }
  })
  @HasPermission(PlayerPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    const { props } = req.body
    const player: Player = req.ctx.state.player // set in the policy

    const em: EntityManager = req.ctx.em

    if (props) {
      const mergedProps = uniqWith([
        ...sanitiseProps(props),
        ...player.props
      ], (a, b) => a.key === b.key)

      player.props = sanitiseProps(mergedProps, true)
    }

    if (req.ctx.state.user.api !== true) {
      await createGameActivity(em, {
        user: req.ctx.state.user,
        game: player.game,
        type: GameActivityType.PLAYER_PROPS_UPDATED,
        extra: {
          playerId: player.id,
          display: {
            'Player': player.id,
            'Updated props': sanitiseProps(props).map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`).join(', ')
          }
        }
      })
    }

    await em.flush()

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @HasPermission(PlayerPolicy, 'getEvents')
  async events(req: Request): Promise<Response> {
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
      .orderBy({ createdAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)
      .getResultList()

    return {
      status: 200,
      body: {
        events,
        count
      }
    }
  }
}
