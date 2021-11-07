import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Routes, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Leaderboard from '../entities/leaderboard'
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

  // todo unique internal names
  @Validate({
    body: ['gameId', 'internalName', 'name', 'sortMode']
  })
  @HasPermission(LeaderboardsPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { internalName, name, sortMode } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard = new Leaderboard(req.ctx.state.game)
    leaderboard.internalName = internalName
    leaderboard.name = name
    leaderboard.sortMode = sortMode

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
