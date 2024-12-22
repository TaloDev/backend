import { Service, Request, Response, Validate, HasPermission, Routes, ValidationCondition } from 'koa-clay'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayerPolicy from '../policies/player.policy'
import PlayerAlias from '../entities/player-alias'
import sanitiseProps from '../lib/props/sanitiseProps'
import { ClickhouseEvent, createEventFromClickhouse } from '../entities/event'
import { EntityManager } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/mysql'
import { uniqWith } from 'lodash'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import PlayerGameStat from '../entities/player-game-stat'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import PlayerProp from '../entities/player-prop'
import PlayerGroup from '../entities/player-group'
import GameSave from '../entities/game-save'
import PlayerAuthActivity from '../entities/player-auth-activity'
import { ClickHouseClient } from '@clickhouse/client'

const propsValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Array.isArray(val),
    error: 'Props must be an array'
  }
]

type PlayerPostBody = {
  aliases?: {
    service: string
    identifier: string
  }[]
  props?: {
    key: string
    value: string
  }[]
}

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
  },
  {
    method: 'GET',
    path: '/:id/auth-activities',
    handler: 'authActivities'
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
    const { aliases, props } = req.body as PlayerPostBody
    const em: EntityManager = req.ctx.em

    const game = await em.getRepository(Game).findOne(req.ctx.state.game)

    const player = new Player(game)
    if (aliases) {
      for await (const alias of aliases) {
        const count = await em.getRepository(PlayerAlias).count({
          service: alias.service,
          identifier: alias.identifier,
          player: { game }
        })

        if (count > 0) {
          req.ctx.throw(400, {
            message: `Player with identifier '${alias.identifier}' already exists`,
            errorCode: 'IDENTIFIER_TAKEN'
          })
        }
      }

      player.aliases.set(aliases.map((item) => {
        const alias = new PlayerAlias()
        alias.service = item.service
        alias.identifier = item.identifier
        return alias
      }))
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
    const itemsPerPage = 25

    const { search, page } = req.query
    const em: EntityManager = req.ctx.em

    const query = em.qb(Player, 'p')
      .select('p.*')
      .orderBy({ lastSeenAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(Number(page ?? 0) * itemsPerPage)

    if (search) {
      query
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
        query
          .orWhere({
            groups: {
              $in: groups
            }
          })
      }
    }

    if (!req.ctx.state.includeDevData) {
      query.andWhere(devDataPlayerFilter(em))
    }

    const [players, count] = await query
      .andWhere({ game: req.ctx.state.game })
      .getResultAndCount()

    await em.populate(players, ['aliases'])

    return {
      status: 200,
      body: {
        players,
        count,
        itemsPerPage
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
      if (req.ctx.state.user.api !== true && props.some((prop) => prop.key.startsWith('META_'))) {
        req.ctx.throw(400, 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name')
      }

      const mergedProps = uniqWith([
        ...sanitiseProps(props, false, (prop) => !prop.key.startsWith('META_')),
        ...player.props
      ], (a, b) => a.key === b.key)

      player.setProps(sanitiseProps(mergedProps, true))
      player.updatedAt = new Date()
    }

    if (req.ctx.state.user.api !== true) {
      createGameActivity(em, {
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

    // refresh groups
    await em.refresh(player)

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @Validate({ query: ['page'] })
  @HasPermission(PlayerPolicy, 'getEvents')
  async events(req: Request): Promise<Response> {
    const itemsPerPage = 50
    const { search, page } = req.query
    const player: Player = req.ctx.state.player // set in the policy

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const aliases = player.aliases.getItems().map((alias) => alias.id).join(',')

    const searchQuery = search ? `AND (name ILIKE '%${search}%' OR prop_value ILIKE '%${search}%')` : ''
    const baseQuery = `FROM events
      LEFT JOIN event_props ON events.id = event_props.event_id
      WHERE player_alias_id IN (${aliases})
        ${searchQuery}`

    const query = `
      SELECT DISTINCT events.*
      ${baseQuery}
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage}
      OFFSET ${Number(page) * itemsPerPage}
    `

    const items = await clickhouse.query({ query, format: 'JSONEachRow' }).then((res) => res.json<ClickhouseEvent>())
    const events = await Promise.all(items.map((item) => createEventFromClickhouse(clickhouse, em, item, true)))

    const countQuery = `
      SELECT count(DISTINCT events.id) AS count
      ${baseQuery}`

    const count = await clickhouse.query({
      query: countQuery,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())

    return {
      status: 200,
      body: {
        events,
        count: Number(count[0].count),
        itemsPerPage
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

  @HasPermission(PlayerPolicy, 'getAuthActivities')
  async authActivities(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const activities = await em.getRepository(PlayerAuthActivity).find({
      player: req.ctx.state.player
    }, {
      populate: ['player.aliases']
    })

    return {
      status: 200,
      body: {
        activities
      }
    }
  }
}
