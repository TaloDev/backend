import { HasPermission, Routes, Request, Response, Validate, ForwardTo, forwardRequest, Docs } from 'koa-clay'
import LeaderboardAPIPolicy from '../../policies/api/leaderboard-api.policy'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/mysql'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'
import LeaderboardAPIDocs from '../../docs/leaderboard-api.docs'
import triggerIntegrations from '../../lib/integrations/triggerIntegrations'
import { devDataPlayerFilter } from '../../middlewares/dev-data-middleware'

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
export default class LeaderboardAPIService extends APIService {
  @Validate({ query: ['page'] })
  @HasPermission(LeaderboardAPIPolicy, 'get')
  @ForwardTo('games.leaderboards', 'entries')
  @Docs(LeaderboardAPIDocs.get)
  async get(req: Request): Promise<Response> {
    return forwardRequest(req, {
      params: {
        id: String(req.ctx.state.leaderboard.id)
      }
    })
  }

  async createEntry(req: Request): Promise<LeaderboardEntry> {
    const em: EntityManager = req.ctx.em

    const entry = new LeaderboardEntry(req.ctx.state.leaderboard)
    entry.playerAlias = req.ctx.state.playerAlias
    entry.score = req.body.score

    await em.persistAndFlush(entry)

    return entry
  }

  @Validate({ body: ['aliasId', 'score'] })
  @HasPermission(LeaderboardAPIPolicy, 'post')
  @Docs(LeaderboardAPIDocs.post)
  async post(req: Request): Promise<Response> {
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
          entry.createdAt = new Date()
          await em.flush()

          updated = true
        }
      } else {
        entry = await this.createEntry(req)
      }
    } catch (err) {
      entry = await this.createEntry(req)
    }

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardEntryCreated(em, entry)
    })

    let baseQuery = em.createQueryBuilder(LeaderboardEntry, 'le')
      .where({ leaderboard: entry.leaderboard })

    if (!req.ctx.state.includeDevData) {
      baseQuery = baseQuery.andWhere({
        playerAlias: {
          player: devDataPlayerFilter(em)
        }
      })
    }

    const entries = await baseQuery
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
