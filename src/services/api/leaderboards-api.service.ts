import { HasPermission, Routes, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import LeaderboardsAPIPolicy from '../../policies/api/leaderboards-api.policy'
import LeaderboardsService from '../leaderboards.service'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/mysql'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'

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
    const key = await this.getAPIKey(req.ctx)
    req.query.gameId = key.game.id.toString()
    return this.forwardRequest('entries', req)
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

    const leaderboard: Leaderboard = req.ctx.state.leaderboard

    let entry: LeaderboardEntry = null
    let updated = false

    try {
      if (leaderboard.unique) {
        entry = await em.getRepository(LeaderboardEntry).findOneOrFail({
          leaderboard,
          playerAlias: req.ctx.state.playerAlias
        })

        if ((leaderboard.sortMode === LeaderboardSortMode.ASC && score < entry.score) || (leaderboard.sortMode === LeaderboardSortMode.DESC && score > entry.score)) {
          entry.score = score
          await em.flush()

          updated = true
        }
      } else {
        entry = await this.createEntry(req)
      }
    } catch (err) {
      entry = await this.createEntry(req)
    }

    const entries = await em.createQueryBuilder(LeaderboardEntry, 'le')
      .where({ leaderboard: entry.leaderboard })
      .select('le.*', true)
      .orderBy({ score: entry.leaderboard.sortMode })
      .getResultList()

    return {
      status: 200,
      body: {
        entry: { position: entries.indexOf(entry), ...entry.toJSON() },
        updated
      }
    }
  }
}
