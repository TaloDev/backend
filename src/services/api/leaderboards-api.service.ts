import { HasPermission, Routes, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import LeaderboardsAPIPolicy from '../../policies/api/leaderboards-api.policy'
import LeaderboardsService from '../leaderboards.service'
import APIService from './api-service'
import { EntityManager, FilterQuery } from '@mikro-orm/core'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Leaderboard from '../../entities/leaderboard'

@Routes([
  {
    method: 'GET',
    path: '/:internalName/entries'
  },
  {
    method: 'POST',
    path: '/:internalName/entries'
  }
])
export default class LeaderboardAPIService extends APIService<LeaderboardsService> {
  constructor() {
    super('leaderboards')
  }

  @HasPermission(LeaderboardsAPIPolicy, 'get')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { internalName } = req.params
    const { aliasId } = req.query
    const em: EntityManager = req.ctx.em

    const whereOptions: FilterQuery<LeaderboardEntry> = {
      leaderboard: {
        game: req.ctx.state.key.game,
        internalName
      }
    }

    if (aliasId) whereOptions.playerAlias = Number(aliasId)

    const entries = await em.getRepository(LeaderboardEntry).find(whereOptions)

    return {
      status: 200,
      body: {
        entries
      }
    }
  }

  async createEntry(req: ServiceRequest): Promise<LeaderboardEntry> {
    const em: EntityManager = req.ctx.em

    const entry = new LeaderboardEntry(req.ctx.state.leaderboard)
    entry.playerAlias = req.ctx.state.playerAlias
    entry.score = req.body.score

    await em.persistAndFlush(entry)

    return entry
  }

  @Validate({
    body: ['aliasId', 'score']
  })
  @HasPermission(LeaderboardsAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { score } = req.body
    const em: EntityManager = req.ctx.em

    let entry = null

    try {
      if ((req.ctx.state.leaderboard as Leaderboard).unique) {
        entry = await em.getRepository(LeaderboardEntry).findOneOrFail({
          leaderboard: req.ctx.state.leaderboard,
          playerAlias: req.ctx.state.playerAlias
        })

        entry.score = score
        await em.flush()
      } else {
        entry = await this.createEntry(req)
      }
    } catch (err) {
      entry = await this.createEntry(req)
    }

    return {
      status: 200,
      body: {
        entry
      }
    }
  }
}
