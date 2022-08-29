import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Routes, Service, Request, Response, Validate } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import Leaderboard from '../entities/leaderboard'
import LeaderboardEntry from '../entities/leaderboard-entry'
import triggerIntegrations from '../lib/integrations/triggerIntegrations'
import createGameActivity from '../lib/logging/createGameActivity'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import LeaderboardPolicy from '../policies/leaderboard.policy'

@Routes([
  {
    method: 'GET',
    path: '/:id',
    handler: 'get'
  },
  {
    method: 'GET',
    handler: 'index'
  },
  {
    method: 'POST'
  },
  {
    method: 'GET',
    path: '/:id/entries',
    handler: 'entries'
  },
  {
    method: 'PATCH',
    path: '/:id/entries/:entryId',
    handler: 'updateEntry'
  },
  {
    method: 'PUT',
    path: '/:id',
    handler: 'updateLeaderboard'
  },
  {
    method: 'DELETE',
    path: '/:id'
  }
])
export default class LeaderboardService extends Service {
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

  @HasPermission(LeaderboardPolicy, 'get')
  async get(req: Request): Promise<Response> {
    return {
      status: 200,
      body: {
        leaderboard: req.ctx.state.leaderboard
      }
    }
  }

  @Validate({ body: [Leaderboard] })
  @HasPermission(LeaderboardPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { internalName, name, sortMode, unique } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard = new Leaderboard(req.ctx.state.game)
    leaderboard.internalName = internalName
    leaderboard.name = name
    leaderboard.sortMode = sortMode
    leaderboard.unique = unique

    await createGameActivity(em, {
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

  @Validate({
    query: ['page']
  })
  @HasPermission(LeaderboardPolicy, 'get')
  async entries(req: Request): Promise<Response> {
    const itemsPerPage = 50

    const { page, aliasId } = req.query
    const em: EntityManager = req.ctx.em

    const leaderboard: Leaderboard = req.ctx.state.leaderboard

    let baseQuery = em.createQueryBuilder(LeaderboardEntry, 'le')
      .where({ leaderboard })

    if (aliasId) {
      baseQuery = baseQuery.andWhere({ playerAlias: Number(aliasId) })
    }

    if (req.ctx.state.user.api === true) {
      baseQuery = baseQuery.andWhere({ hidden: false })
    }

    if (!req.ctx.state.includeDevData) {
      baseQuery = baseQuery.andWhere({
        playerAlias: {
          player: devDataPlayerFilter
        }
      })
    }

    const { count } = await baseQuery
      .count('le.id', true)
      .execute('get')

    const entries = await baseQuery
      .select('le.*', true)
      .orderBy({ score: leaderboard.sortMode })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)
      .getResultList()

    await em.populate(entries, ['playerAlias'])

    return {
      status: 200,
      body: {
        entries: entries.map((entry, idx) => ({ position: idx + (Number(page) * itemsPerPage), ...entry.toJSON() })),
        count,
        isLastPage: (Number(page) * itemsPerPage) + itemsPerPage >= count
      }
    }
  }

  @HasPermission(LeaderboardPolicy, 'updateEntry')
  async updateEntry(req: Request): Promise<Response> {
    const { entryId } = req.params
    const em: EntityManager = req.ctx.em

    const entry = await em.getRepository(LeaderboardEntry).findOne(Number(entryId))
    if (!entry) {
      req.ctx.throw(404, 'Leaderboard entry not found')
    }

    const { hidden } = req.body

    const toggleVisibility = typeof hidden === 'boolean'
    if (toggleVisibility) {
      entry.hidden = hidden

      await createGameActivity(em, {
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

    await em.flush()

    return {
      status: 200,
      body: {
        entry
      }
    }
  }

  @Validate({ body: [Leaderboard] })
  @HasPermission(LeaderboardPolicy, 'updateLeaderboard')
  async updateLeaderboard(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const leaderboard = req.ctx.state.leaderboard

    const updateableKeys: (keyof Leaderboard)[] = ['name', 'sortMode', 'unique']
    const changedProperties = []

    for (const key in req.body) {
      if (updateableKeys.includes(key as keyof Leaderboard)) {
        const original = leaderboard[key]
        leaderboard[key] = req.body[key]
        if (original !== leaderboard[key]) changedProperties.push(key)
      }
    }

    await createGameActivity(em, {
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

  @HasPermission(LeaderboardPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const leaderboardInternalName = req.ctx.state.leaderboard.internalName
    await createGameActivity(em, {
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
}
