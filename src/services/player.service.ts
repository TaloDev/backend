import { Service, Request, Response, Validate, HasPermission, Routes, ValidationCondition } from 'koa-clay'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayerPolicy from '../policies/player.policy'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'
import Event from '../entities/event'
import { EntityManager } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/mysql'
import uniqWith from 'lodash.uniqwith'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import PlayerGameStat from '../entities/player-game-stat'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import PlayerProp from '../entities/player-prop'
import PlayerGroup from '../entities/player-group'
import GameSave from '../entities/game-save'

const itemsPerPage = 25

const propsValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Array.isArray(val),
    error: 'Props must be an array'
  }
]

@Routes([
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
  },
  {
    method: 'GET',
    path: '/:id/stats',
    handler: 'stats'
  },
  {
    method: 'GET',
    path: '/:id/saves',
    handler: 'saves'
  }
])
export default class PlayerService extends Service {
  @Validate({
    body: {
      props: {
        validation: propsValidation
      }
    }
  })
  @HasPermission(PlayerPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { aliases, props } = req.body
    const em: EntityManager = req.ctx.em

    const game = await em.getRepository(Game).findOne(req.ctx.state.game)

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
      player.setProps(props)
    }

    if (req.headers['x-talo-dev-build'] === '1') {
      player.addProp('META_DEV_BUILD', '1')
    }

    await em.persistAndFlush(player)

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @HasPermission(PlayerPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { search, page } = req.query
    const em: EntityManager = req.ctx.em

    let baseQuery = em.qb(Player, 'p')

    if (search) {
      baseQuery = baseQuery
        .where({
          props: {
            $in: em.qb(PlayerProp).select('id').where({
              value: {
                $like: `%${search}%`
              }
            }).getKnexQuery()
          }
        })
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

      const groupFilters = search.split(' ')
        .filter((part) => part.startsWith('group:'))

      const groups = []
      for (const filter of groupFilters) {
        const group = await em.repo(PlayerGroup).findOne({ id: filter.split(':'), game: req.ctx.state.game })
        if (group) groups.push(group)
      }

      if (groups.length > 0) {
        baseQuery = baseQuery
          .orWhere({
            groups: {
              $in: groups
            }
          })
      }
    }

    if (!req.ctx.state.includeDevData) {
      baseQuery = baseQuery.andWhere(devDataPlayerFilter(em))
    }

    baseQuery = baseQuery.andWhere({ game: req.ctx.state.game })

    const { count } = await baseQuery
      .clone()
      .count('p.id', true)
      .execute('get')

    const players = await baseQuery
      .clone()
      .select('p.*', true)
      .orderBy({ lastSeenAt: QueryOrder.DESC })
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
        validation: propsValidation
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
        ...sanitiseProps(props, false, (prop) => !prop.key.startsWith('META_')),
        ...player.props
      ], (a, b) => a.key === b.key)

      player.setProps(sanitiseProps(mergedProps, true))
      player.updatedAt = new Date()
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
      .clone()
      .count('e.id', true)
      .execute('get')

    const events = await baseQuery
      .clone()
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

  @HasPermission(PlayerPolicy, 'getStats')
  async stats(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const stats = await em.getRepository(PlayerGameStat).find({
      player: req.ctx.state.player
    })

    return {
      status: 200,
      body: {
        stats
      }
    }
  }

  @HasPermission(PlayerPolicy, 'getSaves')
  async saves(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const saves = await em.getRepository(GameSave).find({
      player: req.ctx.state.player
    })

    return {
      status: 200,
      body: {
        saves
      }
    }
  }
}
