import { FilterQuery, ObjectQuery, EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import Leaderboard, { LeaderboardRefreshInterval, LeaderboardSortMode } from '../entities/leaderboard'
import LeaderboardEntry from '../entities/leaderboard-entry'
import PlayerAlias from '../entities/player-alias'
import triggerIntegrations from '../lib/integrations/triggerIntegrations'
import createGameActivity from '../lib/logging/createGameActivity'
import LeaderboardPolicy from '../policies/leaderboard.policy'
import { archiveEntriesForLeaderboard } from '../tasks/archiveLeaderboardEntries'
import updateAllowedKeys from '../lib/entities/updateAllowedKeys'
import { pageValidation } from '../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../lib/pagination/itemsPerPage'
import { clearResponseCache, withResponseCache } from '../lib/perf/responseCache'
import { resetModeValidation, ResetMode, translateResetMode } from '../lib/validation/resetModeValidation'

async function getGlobalEntryIds({
  em,
  aliasId,
  leaderboard,
  entries,
  includeDevData,
  includeDeleted
}: {
  em: EntityManager
  includeDevData: boolean
  aliasId: string
  leaderboard: Leaderboard
  entries: LeaderboardEntry[]
  includeDeleted: boolean
}): Promise<number[]> {
  if (aliasId && entries.length > 0) {
    const scores = entries.map((entry) => entry.score)
    const globalQuery = em.qb(LeaderboardEntry)
      .select('id')
      .where({ leaderboard, hidden: false })
      .andWhere(includeDeleted ? {} : { deletedAt: null })
      .andWhere({
        $or: [
          // entries with better scores
          {
            score: leaderboard.sortMode === LeaderboardSortMode.ASC
              ? { $lt: Math.min(...scores) }
              : { $gt: Math.max(...scores) }
          },
          // entries with equal scores
          {
            score: { $in: scores }
          }
        ]
      })
      .orderBy({
        score: leaderboard.sortMode,
        createdAt: 'asc'
      })

    if (!includeDevData) {
      globalQuery.andWhere({
        playerAlias: {
          player: {
            devBuild: false
          }
        }
      })
    }

    return (await globalQuery.getResultList()).map((entry) => entry.id)
  }

  return []
}

export default class LeaderboardService extends Service {
  @Route({
    method: 'GET'
  })
  @HasPermission(LeaderboardPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const leaderboards = await em.getRepository(Leaderboard).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        leaderboards
      }
    }
  }

  @Route({
    method: 'POST'
  })
  @Validate({ body: [Leaderboard] })
  @HasPermission(LeaderboardPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { internalName, name, sortMode, unique, refreshInterval } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard = new Leaderboard(req.ctx.state.game)
    leaderboard.internalName = internalName
    leaderboard.name = name
    leaderboard.sortMode = sortMode
    leaderboard.unique = unique
    leaderboard.refreshInterval = refreshInterval

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_CREATED,
      extra: {
        leaderboardInternalName: leaderboard.internalName
      }
    })

    await em.persistAndFlush(leaderboard)

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardCreated(em, leaderboard)
    })

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id/entries'
  })
  @Validate({
    query: {
      page: pageValidation
    }
  })
  @HasPermission(LeaderboardPolicy, 'get')
  async entries(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const { page = 0, aliasId, withDeleted, propKey, propValue } = req.query
    const em: EntityManager = req.ctx.em

    const leaderboard: Leaderboard = req.ctx.state.leaderboard
    const includeDeleted = withDeleted === '1'

    const devDataComponent = req.ctx.state.includeDevData ? 'dev' : 'no-dev'
    const cacheKey = `${leaderboard.getEntriesCacheKey()}-${page}-${aliasId}-${withDeleted}-${propKey}-${propValue}-${devDataComponent}`

    return withResponseCache({
      redis: req.ctx.redis,
      key: cacheKey,
      ttl: 600
    }, async () => {
      const where: FilterQuery<LeaderboardEntry> = { leaderboard }

      if (!includeDeleted) {
        where.deletedAt = null
      }

      if (aliasId) {
        where.playerAlias = {
          id: Number(aliasId)
        }
      }

      if (req.ctx.state.user.api === true) {
        where.hidden = false
      }

      if (!req.ctx.state.includeDevData) {
        where.playerAlias = {
          ...((where.playerAlias as ObjectQuery<PlayerAlias>) ?? {}),
          player: {
            devBuild: false
          }
        }
      }

      if (propKey) {
        if (propValue) {
          where.props = {
            $some: {
              key: propKey,
              value: propValue
            }
          }
        } else {
          where.props = {
            $some: {
              key: propKey
            }
          }
        }
      }

      const [entries, count] = await em.repo(LeaderboardEntry).findAndCount(where, {
        orderBy: {
          score: leaderboard.sortMode,
          createdAt: 'asc'
        },
        limit: itemsPerPage + 1,
        offset: Number(page) * itemsPerPage,
        populate: ['playerAlias']
      })

      const globalEntryIds: number[] = await getGlobalEntryIds({
        em,
        aliasId,
        leaderboard,
        entries,
        includeDevData: req.ctx.state.includeDevData,
        includeDeleted
      })

      const mappedEntries = await Promise.all(entries.slice(0, itemsPerPage).map(async (entry, idx) => {
        const position = aliasId
          ? globalEntryIds.indexOf(entry.id)
          : idx + (Number(page) * itemsPerPage)

        return {
          position,
          ...entry.toJSON()
        }
      }))

      return {
        status: 200,
        body: {
          entries: mappedEntries,
          count,
          itemsPerPage,
          isLastPage: entries.length <= itemsPerPage
        }
      }
    })
  }

  @Route({
    method: 'PATCH',
    path: '/:id/entries/:entryId'
  })
  @HasPermission(LeaderboardPolicy, 'updateEntry')
  async updateEntry(req: Request): Promise<Response> {
    const { entryId } = req.params
    const em: EntityManager = req.ctx.em

    const entry = await em.getRepository(LeaderboardEntry).findOne(Number(entryId))
    if (!entry) {
      req.ctx.throw(404, 'Leaderboard entry not found')
    }

    const { hidden, newScore } = req.body

    if (typeof hidden === 'boolean') {
      entry.hidden = hidden

      createGameActivity(em, {
        user: req.ctx.state.user,
        game: entry.leaderboard.game,
        type: hidden ? GameActivityType.LEADERBOARD_ENTRY_HIDDEN : GameActivityType.LEADERBOARD_ENTRY_RESTORED,
        extra: {
          leaderboardInternalName: entry.leaderboard.internalName,
          entryId: entry.id,
          display: {
            'Player': entry.playerAlias.player.id,
            'Score': entry.score
          }
        }
      })

      await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryVisibilityToggled(em, entry)
      })
    }

    if (typeof newScore === 'number') {
      const oldScore = entry.score
      entry.score = newScore

      createGameActivity(em, {
        user: req.ctx.state.user,
        game: entry.leaderboard.game,
        type: GameActivityType.LEADERBOARD_ENTRY_UPDATED,
        extra: {
          leaderboardInternalName: entry.leaderboard.internalName,
          entryId: entry.id,
          display: {
            'Player': entry.playerAlias.player.id,
            'Leaderboard': entry.leaderboard.internalName,
            'Old score': oldScore,
            'New score': newScore
          }
        }
      })

      await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryCreated(em, entry)
      })
    }

    await em.flush()
    await clearResponseCache(req.ctx.redis, entry.leaderboard.getEntriesCacheKey(true))

    return {
      status: 200,
      body: {
        entry
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id'
  })
  @Validate({ body: [Leaderboard] })
  @HasPermission(LeaderboardPolicy, 'updateLeaderboard')
  async updateLeaderboard(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const [leaderboard, changedProperties] = updateAllowedKeys(
      req.ctx.state.leaderboard as Leaderboard,
      req.body,
      ['name', 'sortMode', 'unique', 'refreshInterval']
    )

    if (changedProperties.includes('refreshInterval') && leaderboard.refreshInterval !== LeaderboardRefreshInterval.NEVER) {
      await archiveEntriesForLeaderboard(em, leaderboard)
    }

    await clearResponseCache(req.ctx.redis, leaderboard.getEntriesCacheKey(true))

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_UPDATED,
      extra: {
        leaderboardInternalName: leaderboard.internalName,
        display: {
          'Updated properties': changedProperties.map((prop) => `${prop}: ${req.body[prop]}`).join(', ')
        }
      }
    })

    await em.flush()

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardUpdated(em, leaderboard)
    })

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
  @HasPermission(LeaderboardPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const leaderboardInternalName = req.ctx.state.leaderboard.internalName
    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.leaderboard.game,
      type: GameActivityType.LEADERBOARD_DELETED,
      extra: {
        leaderboardInternalName
      }
    })

    await em.removeAndFlush(req.ctx.state.leaderboard)

    await triggerIntegrations(em, req.ctx.state.game, (integration) => {
      return integration.handleLeaderboardDeleted(em, leaderboardInternalName)
    })

    return {
      status: 204
    }
  }

  @Route({
    method: 'GET',
    path: '/search'
  })
  @Validate({ query: ['internalName'] })
  @HasPermission(LeaderboardPolicy, 'search')
  async search(req: Request): Promise<Response> {
    const { internalName } = req.query
    const em: EntityManager = req.ctx.em

    const leaderboard = await em.getRepository(Leaderboard).findOne({
      internalName,
      game: req.ctx.state.game
    })

    if (!leaderboard) req.ctx.throw(404, 'Leaderboard not found')

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id/entries'
  })
  @Validate({
    query: {
      mode: resetModeValidation
    }
  })
  @HasPermission(LeaderboardPolicy, 'reset')
  async reset(req: Request): Promise<Response> {
    const { mode = 'all' } = req.query as { mode?: ResetMode }
    const em: EntityManager = req.ctx.em
    const leaderboard: Leaderboard = req.ctx.state.leaderboard

    const where: FilterQuery<LeaderboardEntry> = { leaderboard }

    if (mode === 'dev') {
      where.playerAlias = {
        player: {
          devBuild: true
        }
      }
    } else if (mode === 'live') {
      where.playerAlias = {
        player: {
          devBuild: false
        }
      }
    }

    const entriesToDelete = await em.repo(LeaderboardEntry).find(where, {
      populate: ['playerAlias.player']
    })

    const deletedCount = entriesToDelete.length

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_ENTRIES_RESET,
      extra: {
        leaderboardInternalName: leaderboard.internalName,
        display: {
          'Reset mode': translateResetMode(mode),
          'Deleted count': deletedCount
        }
      }
    })

    await em.removeAndFlush(entriesToDelete)
    await clearResponseCache(req.ctx.redis, leaderboard.getEntriesCacheKey(true))

    // todo: update steam leaderboards

    return {
      status: 200,
      body: {
        deletedCount
      }
    }
  }
}
