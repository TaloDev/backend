import { Service, Request, Response, Validate, HasPermission, Route, ValidationCondition } from 'koa-clay'
import Game from '../entities/game'
import Player from '../entities/player'
import PlayerPolicy from '../policies/player.policy'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { sanitiseProps, mergeAndSanitiseProps, hardSanitiseProps } from '../lib/props/sanitiseProps'
import Event, { ClickHouseEvent } from '../entities/event'
import { EntityManager, LockMode, FilterQuery } from '@mikro-orm/mysql'
import { QueryOrder } from '@mikro-orm/mysql'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import PlayerGameStat from '../entities/player-game-stat'
import GameSave from '../entities/game-save'
import PlayerAuthActivity from '../entities/player-auth-activity'
import { ClickHouseClient } from '@clickhouse/client'
import checkPricingPlanPlayerLimit from '../lib/billing/checkPricingPlanPlayerLimit'
import Prop from '../entities/prop'
import buildErrorResponse from '../lib/errors/buildErrorResponse'
import { PropSizeError } from '../lib/errors/propSizeError'
import { captureException } from '@sentry/node'
import { DEFAULT_PAGE_SIZE, SMALL_PAGE_SIZE } from '../lib/pagination/itemsPerPage'
import { pageValidation } from '../lib/pagination/pageValidation'
import { withResponseCache } from '../lib/perf/responseCache'

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

    const game = await em.getRepository(Game).findOneOrFail(req.ctx.state.game, {
      populate: ['organisation']
    })
    await checkPricingPlanPlayerLimit(req, game.organisation)

    const player = new Player(game)
    if (aliases) {
      for await (const alias of aliases) {
        alias.service = alias.service.trim()
        alias.identifier = alias.identifier.trim()

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
        if (!(err instanceof PropSizeError)) {
          captureException(err)
        }
        return buildErrorResponse({ props: [(err as Error).message] })
      }
    }

    if (req.headers['x-talo-dev-build'] === '1') {
      player.markAsDevBuild()
    }

    await em.persistAndFlush(player)
    await player.checkGroupMemberships(em)

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
  @Validate({
    query: {
      page: pageValidation
    }
  })
  @HasPermission(PlayerPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const itemsPerPage = SMALL_PAGE_SIZE
    const { search, page = 0 } = req.query
    const em: EntityManager = req.ctx.em

    const searchComponent = search ? encodeURIComponent(search) : 'no-search'
    const devDataComponent = req.ctx.state.includeDevData ? 'dev' : 'no-dev'
    const cacheKey = `player-search-${req.ctx.state.game.id}-${searchComponent}-${page}-${devDataComponent}`

    return withResponseCache({ key: cacheKey }, async () => {
      const where: FilterQuery<Player> = { game: req.ctx.state.game }

      if (!req.ctx.state.includeDevData) {
        where.devBuild = false
      }

      if (search) {
        const searchConditions: FilterQuery<Player>[] = [
          {
            props: {
              $some: {
                value: {
                  $like: `%${search}%`
                }
              }
            }
          },
          {
            aliases: {
              identifier: {
                $like: `%${search}%`
              }
            }
          },
          {
            id: {
              $like: `%${search}%`
            }
          }
        ]

        const groupFilters = search.split(' ')
          .filter((part) => part.startsWith('group:'))

        if (!req.ctx.state.user.api) {
          for (const filter of groupFilters) {
            const groupId = filter.split(':')[1]
            if (groupId) {
              searchConditions.push({
                groups: {
                  $some: groupId
                }
              })
            }
          }
        }

        const channelFilters = search.split(' ')
          .filter((part) => part.startsWith('channel:'))

        if (!req.ctx.state.user.api) {
          for (const filter of channelFilters) {
            const channelId = Number(filter.split(':')[1])
            if (channelId && !isNaN(channelId)) {
              searchConditions.push({
                aliases: {
                  channels: {
                    $some: channelId
                  }
                }
              })
            }
          }
        }

        where.$or = searchConditions
      }

      const [allPlayers, count] = await em.repo(Player).findAndCount(where, {
        populate: ['aliases'],
        orderBy: { lastSeenAt: QueryOrder.DESC },
        limit: itemsPerPage + 1,
        offset: Number(page) * itemsPerPage
      })

      const players = allPlayers.slice(0, itemsPerPage)

      return {
        status: 200,
        body: {
          players,
          count,
          itemsPerPage,
          isLastPage: allPlayers.length <= itemsPerPage
        }
      }
    })
  }

  @Route({
    method: 'GET',
    path: '/:id'
  })
  @HasPermission(PlayerPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const player: Player = req.ctx.state.player // set in the policy
    await player.props.loadItems()

    return {
      status: 200,
      body: {
        player
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

    const [player, errorResponse] = await em.transactional(async (trx): Promise<PatchTransactionResponse> => {
      const player = await trx.refreshOrFail(req.ctx.state.player as Player, { lockMode: LockMode.PESSIMISTIC_WRITE })

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
        createGameActivity(trx, {
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

      return [player, null]
    })

    if (errorResponse) {
      return errorResponse
    }

    if (player) {
      await player.checkGroupMemberships(em)
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
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { search, page } = req.query
    const player: Player = req.ctx.state.player // set in the policy

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const searchQuery = search
      ? 'AND (e.name ILIKE {search: String} OR e.id IN (SELECT event_id FROM event_props WHERE prop_value ILIKE {search: String}))'
      : ''

    const baseQuery = `FROM events e
      WHERE e.player_alias_id IN ({aliasIds:Array(UInt32)})
        ${searchQuery}`

    const query = `
      WITH filtered_events AS (
        SELECT e.*
        ${baseQuery}
      )
      SELECT 
        *,
        count(*) OVER() as total_count
      FROM filtered_events
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage}
      OFFSET ${Number(page) * itemsPerPage}
    `

    const queryParams = {
      search: `%${search}%`,
      aliasIds: player.aliases.getItems().map((alias) => alias.id)
    }

    const results = await clickhouse.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHouseEvent & { total_count: string }>())

    const events = await Event.massHydrate(em, results, clickhouse, true)
    const count = results.length > 0 ? Number(results[0].total_count) : 0

    return {
      status: 200,
      body: {
        events,
        count,
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

