import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Routes, Service, Request, Response, Validate, ValidationCondition } from 'koa-clay'
import GameActivity, { GameActivityType } from '../entities/game-activity'
import Leaderboard, { LeaderboardSortMode } from '../entities/leaderboard'
import LeaderboardEntry from '../entities/leaderboard-entry'
import createGameActivity from '../lib/logging/createGameActivity'
import LeaderboardPolicy from '../policies/leaderboard.policy'

@Routes([
  {
    method: 'GET',
    path: '/:internalName',
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
    path: '/:internalName/entries',
    handler: 'entries'
  },
  {
    method: 'PATCH',
    path: '/:internalName/entries/:id',
    handler: 'updateEntry'
  },
  {
    method: 'PATCH',
    path: '/:internalName',
    handler: 'updateLeaderboard'
  },
  {
    method: 'DELETE',
    path: '/:internalName'
  }
])
export default class LeaderboardService implements Service {
  @Validate({
    query: ['gameId']
  })
  @HasPermission(LeaderboardPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const leaderboards = await em.getRepository(Leaderboard).find({ game: Number(gameId) })

    return {
      status: 200,
      body: {
        leaderboards
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(LeaderboardPolicy, 'get')
  async get(req: Request): Promise<Response> {
    return {
      status: 200,
      body: {
        leaderboard: req.ctx.state.leaderboard
      }
    }
  }

  @Validate({
    body: {
      gameId: {
        required: true
      },
      internalName: {
        required: true,
        validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
          const em: EntityManager = req.ctx.em
          const duplicateInternalName = await em.getRepository(Leaderboard).findOne({ internalName: val, game: req.body.gameId })

          return [
            {
              check: !duplicateInternalName,
              error: `A leaderboard with the internalName ${val} already exists`
            }
          ]
        }
      },
      name: {
        required: true
      },
      sortMode: {
        required: true,
        validation: async (val: unknown): Promise<ValidationCondition[]> => {
          const keys = Object.keys(LeaderboardSortMode).map((key) => LeaderboardSortMode[key])

          return [
            {
              check: keys.includes(val),
              error: `Sort mode must be one of ${keys.join(', ')}`
            }
          ]
        }
      },
      unique: {
        required: true
      }
    }
  })
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

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Validate({
    query: ['gameId', 'page']
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

    const { count } = await baseQuery
      .count('le.id', true)
      .execute('get')

    const entries = await baseQuery
      .select('le.*', true)
      .orderBy({ score: leaderboard.sortMode })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)
      .getResultList()

    return {
      status: 200,
      body: {
        entries: entries.map((entry, idx) => ({ position: idx + (Number(page) * itemsPerPage), ...entry.toJSON() })),
        count
      }
    }
  }

  @Validate({
    body: ['gameId']
  })
  @HasPermission(LeaderboardPolicy, 'updateEntry')
  async updateEntry(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em

    const entry = await em.getRepository(LeaderboardEntry).findOne(Number(id))
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
    }

    await em.flush()

    return {
      status: 200,
      body: {
        entry
      }
    }
  }

  @Validate({
    body: ['gameId']
  })
  @HasPermission(LeaderboardPolicy, 'updateLeaderboard')
  async updateLeaderboard(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const { name, sortMode, unique } = req.body
    const leaderboard = req.ctx.state.leaderboard

    if (name) leaderboard.name = name
    if (sortMode) leaderboard.sortMode = sortMode
    if (typeof unique === 'boolean') leaderboard.unique = unique

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_UPDATED,
      extra: {
        leaderboardInternalName: leaderboard.internalName,
        display: {
          'Updated properties': Object.keys(req.body).filter((key) => key !== 'gameId').map((key) => `${key}: ${req.body[key]}`).join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Validate({
    body: ['gameId']
  })
  @HasPermission(LeaderboardPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.leaderboard.game,
      type: GameActivityType.LEADERBOARD_DELETED,
      extra: {
        leaderboardInternalName: req.ctx.state.leaderboard.internalName
      }
    })

    await em.getRepository(GameActivity).removeAndFlush(req.ctx.state.leaderboard)

    return {
      status: 200
    }
  }
}