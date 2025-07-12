import { Service, Request, Response, Validate, HasPermission, Route, ValidationCondition } from 'koa-clay'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayerPolicy from '../policies/player.policy'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { sanitiseProps, mergeAndSanitiseProps, hardSanitiseProps } from '../lib/props/sanitiseProps'
import Event, { ClickHouseEvent } from '../entities/event'
import { EntityManager, LockMode } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/mysql'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import PlayerGameStat from '../entities/player-game-stat'
import { devDataPlayerFilter } from '../middleware/dev-data-middleware'
import PlayerProp from '../entities/player-prop'
import PlayerGroup from '../entities/player-group'
import GameSave from '../entities/game-save'
import PlayerAuthActivity from '../entities/player-auth-activity'
import { ClickHouseClient } from '@clickhouse/client'
import checkPricingPlanPlayerLimit from '../lib/billing/checkPricingPlanPlayerLimit'
import GameChannel from '../entities/game-channel'
import Prop from '../entities/prop'
import buildErrorResponse from '../lib/errors/buildErrorResponse'
import { PropSizeError } from '../lib/errors/propSizeError'
import { TraceService } from '../lib/tracing/trace-service'

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

type PatchTransactionResponse = [Player | null, ReturnType<typeof buildErrorResponse> | null]

@TraceService()
export default class PlayerService extends Service {
  @Route({
    method: 'POST'
  })
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

    const game = await em.getRepository(Game).findOneOrFail(req.ctx.state.game, { populate: ['organisation'] })
    await checkPricingPlanPlayerLimit(req, game.organisation)

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
      try {
        player.setProps(hardSanitiseProps(props))
      } catch (err) {
        if (err instanceof PropSizeError) {
          return buildErrorResponse({ props: [err.message] })
        /* v8 ignore start */
        }
        throw err
        /* v8 ignore end */
      }
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

  @Route({
    method: 'GET'
  })
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
        const id = filter.split(':')[1]
        const group = await em.repo(PlayerGroup).findOne({ id, game: req.ctx.state.game })
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

      const channelFilters = search.split(' ')
        .filter((part) => part.startsWith('channel:'))

      const channels = []
      for (const filter of channelFilters) {
        const id = filter.split(':')[1]
        const channel = await em.repo(GameChannel).findOne({ id: Number(id), game: req.ctx.state.game })
        if (channel) channels.push(channel)
      }

      if (channels.length > 0) {
        query
          .orWhere({
            aliases: {
              $in: await em.repo(PlayerAlias).find({
                channels: {
                  $in: channels
                }
              })
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

  @Route({
    method: 'PATCH',
    path: '/:id'
  })
  @Validate({
    body: {
      props: {
        validation: propsValidation
      }
    }
  })
  @HasPermission(PlayerPolicy, 'patch')
  async patch(req: Request<{ props: Prop[] }>): Promise<Response> {
    const { props } = req.body
    const em: EntityManager = req.ctx.em

    const [player, errorResponse] = await em.transactional(async (em): Promise<PatchTransactionResponse> => {
      const player = await em.repo(Player).findOneOrFail((req.ctx.state.player as Player).id, { lockMode: LockMode.PESSIMISTIC_WRITE })

      if (props) {
        if (req.ctx.state.user.api !== true && props.some((prop) => prop.key.startsWith('META_'))) {
          const errorMessage = 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name'
          return [null, buildErrorResponse({ props: [errorMessage] }) ]
        }

        try {
          player.setProps(mergeAndSanitiseProps(player.props.getItems(), props, (prop) => !prop.key.startsWith('META_')))
        } catch (err) {
          if (err instanceof PropSizeError) {
            return [null, buildErrorResponse({ props: [err.message] })]
          }
          throw err
        }
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

      // step 1: update props
      await em.flush()

      return [player, null]
    })

    if (errorResponse) {
      return errorResponse
    }

    if (player) {
      // step 2: check for group membership changes
      player.updatedAt = new Date()
      await em.flush()

      // step 3: get the latest group memberships
      await em.refresh(player)
    }

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id/events'
  })
  @Validate({ query: ['page'] })
  @HasPermission(PlayerPolicy, 'getEvents')
  async events(req: Request): Promise<Response> {
    const itemsPerPage = 50
    const { search, page } = req.query
    const player: Player = req.ctx.state.player // set in the policy

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const aliases = player.aliases.getItems().map((alias) => alias.id).join(',')

    const searchQuery = search ? 'AND (name ILIKE {search: String} OR prop_value ILIKE {search: String})' : ''
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

    const queryParams = { search: `%${search}%` }

    const items = await clickhouse.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHouseEvent>())
    const events = await Promise.all(items.map((data) => new Event().hydrate(em, data, clickhouse, true)))

    const countQuery = `
      SELECT count(DISTINCT events.id) AS count
      ${baseQuery}`

    const count = await clickhouse.query({
      query: countQuery,
      query_params: queryParams,
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

  @Route({
    method: 'GET',
    path: '/:id/stats'
  })
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

  @Route({
    method: 'GET',
    path: '/:id/saves'
  })
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

  @Route({
    method: 'GET',
    path: '/:id/auth-activities'
  })
  @HasPermission(PlayerPolicy, 'getAuthActivities')
  async authActivities(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const hasTaloAlias = await em.repo(PlayerAlias).count({
      player: req.ctx.state.player,
      service: PlayerAliasService.TALO
    }) > 0

    if (!hasTaloAlias) {
      return {
        status: 200,
        body: {
          activities: []
        }
      }
    }

    const activities = await em.repo(PlayerAuthActivity).find({
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

