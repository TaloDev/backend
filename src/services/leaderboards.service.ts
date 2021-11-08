import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Routes, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Leaderboard, { LeaderboardSortMode } from '../entities/leaderboard'
import LeaderboardsPolicy from '../policies/leaderboards.policy'

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
  }
])
export default class LeaderboardsService implements Service {
  @Validate({
    query: ['gameId']
  })
  @HasPermission(LeaderboardsPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
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
  @HasPermission(LeaderboardsPolicy, 'get')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    return {
      status: 200,
      body: {
        leaderboard: req.ctx.state.leaderboard
      }
    }
  }

  @Validate({
    body: {
      gameId: true,
      internalName: async (val: string, req: ServiceRequest): Promise<boolean> => {
        const em: EntityManager = req.ctx.em
        const duplicateInternalName = await em.getRepository(Leaderboard).findOne({ internalName: val })

        if (duplicateInternalName) throw new Error(`A leaderboard with the internalName ${val} already exists`)

        return true
      },
      name: true,
      sortMode: async (val: string): Promise<boolean> => {
        const keys = Object.keys(LeaderboardSortMode).map((key) => LeaderboardSortMode[key])
        if (!keys.includes(val)) throw new Error(`Sort mode must be one of ${keys.join(', ')}`)

        return true
      },
      unique: true
    }
  })
  @HasPermission(LeaderboardsPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { internalName, name, sortMode, unique } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard = new Leaderboard(req.ctx.state.game)
    leaderboard.internalName = internalName
    leaderboard.name = name
    leaderboard.sortMode = sortMode
    leaderboard.unique = unique

    await em.persistAndFlush(leaderboard)

    return {
      status: 200,
      body: {
        leaderboard
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(LeaderboardsPolicy, 'get')
  async entries(req: ServiceRequest): Promise<ServiceResponse> {
    return {
      status: 200,
      body: {
        entries: (req.ctx.state.leaderboard as Leaderboard).getSortedEntries()
      }
    }
  }
}
