import { HasPermission, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import LeaderboardsAPIPolicy from '../../policies/api/leaderboards-api.policy'
import LeaderboardsService from '../leaderboards.service'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/core'
import LeaderboardEntry from '../../entities/leaderboard-entry'

export default class LeaderboardAPIService extends APIService<LeaderboardsService> {
  constructor() {
    super('leaderboards')
  }

  @Validate({
    query: ['aliasId', 'internalName']
  })
  @HasPermission(LeaderboardsAPIPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
    const { aliasId, internalName } = req.query
    const em: EntityManager = req.ctx.em

    const entries = await em.getRepository(LeaderboardEntry).find({
      playerAlias: Number(aliasId),
      leaderboard: {
        game: req.ctx.state.key.game,
        internalName
      }
    })

    return {
      status: 200,
      body: {
        entries
      }
    }
  }

  @Validate({
    body: ['aliasId', 'internalName', 'score']
  })
  @HasPermission(LeaderboardsAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { score } = req.body
    const em: EntityManager = req.ctx.em

    let entry = null

    try {
      entry = await em.getRepository(LeaderboardEntry).findOneOrFail({
        leaderboard: req.ctx.state.leaderboard,
        playerAlias: req.ctx.state.playerAlias
      })

      entry.score = score

      await em.flush()
    } catch (err) {
      entry = new LeaderboardEntry(req.ctx.state.leaderboard)
      entry.playerAlias = req.ctx.state.playerAlias
      entry.score = score

      await em.persistAndFlush(entry)
    }

    return {
      status: 200,
      body: {
        entry
      }
    }
  }
}
