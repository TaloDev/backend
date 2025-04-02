import { HasPermission, Request, Response, Route, Validate, ForwardTo, forwardRequest, ValidationCondition } from 'koa-clay'
import LeaderboardAPIPolicy from '../../policies/api/leaderboard-api.policy'
import APIService from './api-service'
import { EntityManager, NotFoundError } from '@mikro-orm/mysql'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'
import LeaderboardAPIDocs from '../../docs/leaderboard-api.docs'
import triggerIntegrations from '../../lib/integrations/triggerIntegrations'
import { devDataPlayerFilter } from '../../middlewares/dev-data-middleware'
import { hardSanitiseProps, mergeAndSanitiseProps } from '../../lib/props/sanitiseProps'
import { PropSizeError } from '../../lib/errors/propSizeError'
import buildErrorResponse from '../../lib/errors/buildErrorResponse'

export default class LeaderboardAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/:internalName/entries',
    docs: LeaderboardAPIDocs.get
  })
  @Validate({ query: ['page'] })
  @HasPermission(LeaderboardAPIPolicy, 'get')
  @ForwardTo('games.leaderboards', 'entries')
  async get(req: Request): Promise<Response> {
    return forwardRequest(req, {
      params: {
        id: String(req.ctx.state.leaderboard.id)
      }
    })
  }

  async createEntry(req: Request, props?: { key: string, value: string }[]): Promise<LeaderboardEntry> {
    const em: EntityManager = req.ctx.em

    const entry = new LeaderboardEntry(req.ctx.state.leaderboard)
    entry.playerAlias = req.ctx.state.alias
    entry.score = req.body.score
    if (req.ctx.state.continuityDate) {
      entry.createdAt = req.ctx.state.continuityDate
    }
    if (props) {
      entry.props = hardSanitiseProps(props)
    }

    await em.persistAndFlush(entry)

    return entry
  }

  @Route({
    method: 'POST',
    path: '/:internalName/entries',
    docs: LeaderboardAPIDocs.post
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: {
      score: {
        required: true
      },
      props: {
        validation: async (val: unknown): Promise<ValidationCondition[]> => [
          {
            check: val ? Array.isArray(val) : true,
            error: 'Props must be an array'
          }
        ]
      }
    }
  })
  @HasPermission(LeaderboardAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { score, props } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard: Leaderboard = req.ctx.state.leaderboard

    let entry: LeaderboardEntry | null = null
    let updated = false

    try {
      if (leaderboard.unique) {
        entry = await em.getRepository(LeaderboardEntry).findOneOrFail({
          leaderboard,
          playerAlias: req.ctx.state.alias,
          deletedAt: null
        })

        if ((leaderboard.sortMode === LeaderboardSortMode.ASC && score < entry.score) || (leaderboard.sortMode === LeaderboardSortMode.DESC && score > entry.score)) {
          entry.score = score
          entry.createdAt = req.ctx.state.continuityDate ?? new Date()
          if (props) {
            entry.props = mergeAndSanitiseProps(entry.props, props)
          }
          await em.flush()

          updated = true
        }
      } else {
        entry = await this.createEntry(req, props)
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        entry = await this.createEntry(req, props)
      } else if (err instanceof PropSizeError) {
        return buildErrorResponse({ props: [err.message] })
      /* v8 ignore next 3 */
      } else {
        throw err
      }
    }

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardEntryCreated(em, entry)
    })

    const query = em.qb(LeaderboardEntry, 'le')
      .select('le.*', true)
      .where({
        leaderboard: entry.leaderboard,
        hidden: false,
        deletedAt: null
      })
      .orderBy({ score: entry.leaderboard.sortMode })

    if (!req.ctx.state.includeDevData) {
      query.andWhere({
        playerAlias: {
          player: devDataPlayerFilter(em)
        }
      })
    }

    const entries = await query.getResultList()

    return {
      status: 200,
      body: {
        entry: { position: entries.indexOf(entry), ...entry.toJSON() },
        updated
      }
    }
  }
}
