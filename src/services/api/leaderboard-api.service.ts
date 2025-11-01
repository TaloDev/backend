import { HasPermission, Request, Response, Route, Validate, ForwardTo, forwardRequest, ValidationCondition } from 'koa-clay'
import LeaderboardAPIPolicy from '../../policies/api/leaderboard-api.policy'
import APIService from './api-service'
import { EntityManager, NotFoundError, LockMode } from '@mikro-orm/mysql'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'
import LeaderboardAPIDocs from '../../docs/leaderboard-api.docs'
import triggerIntegrations from '../../lib/integrations/triggerIntegrations'
import { hardSanitiseProps, mergeAndSanitiseProps } from '../../lib/props/sanitiseProps'
import { PropSizeError } from '../../lib/errors/propSizeError'
import buildErrorResponse from '../../lib/errors/buildErrorResponse'
import { UniqueLeaderboardEntryPropsDigestError } from '../../lib/errors/uniqueLeaderboardEntryPropsDigestError'
import PlayerAlias from '../../entities/player-alias'

export default class LeaderboardAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/:internalName/entries',
    docs: LeaderboardAPIDocs.get
  })
  @HasPermission(LeaderboardAPIPolicy, 'get')
  @ForwardTo('games.leaderboards', 'entries')
  async get(req: Request): Promise<Response> {
    return forwardRequest(req, {
      params: {
        id: String(req.ctx.state.leaderboard.id)
      }
    })
  }

  private createEntry({
    leaderboard,
    playerAlias,
    score,
    continuityDate,
    props
  }: {
    leaderboard: Leaderboard
    playerAlias: PlayerAlias
    score: number
    continuityDate?: Date
    props: { key: string, value: string }[]
  }): LeaderboardEntry {
    const entry = new LeaderboardEntry(leaderboard)
    entry.playerAlias = playerAlias
    entry.score = score
    if (continuityDate) {
      entry.createdAt = continuityDate
    }
    if (props.length > 0) {
      entry.setProps(hardSanitiseProps({ props }))
    }
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
    const { score, props = [] } = req.body
    const em: EntityManager = req.ctx.em

    const leaderboard: Leaderboard = req.ctx.state.leaderboard

    let result: { entry: LeaderboardEntry | null, updated: boolean, errorResponse?: ReturnType<typeof buildErrorResponse> }

    try {
      result = await em.transactional(async (trx) => {
        // lock the alias to prevent concurrent entry creation
        const lockedAlias = await trx.findOneOrFail(PlayerAlias, req.ctx.state.alias.id, {
          lockMode: LockMode.PESSIMISTIC_WRITE
        })

        let entry: LeaderboardEntry | null = null
        let updated = false

        try {
          if (leaderboard.unique) {
            if (leaderboard.uniqueByProps) {
              entry = await leaderboard.findEntryWithProps({
                em: trx,
                playerAliasId: lockedAlias.id,
                props
              })
              if (!entry) {
                throw new UniqueLeaderboardEntryPropsDigestError()
              }
            } else {
              entry = await trx.repo(LeaderboardEntry).findOneOrFail({
                leaderboard,
                playerAlias: lockedAlias,
                deletedAt: null
              })
            }

            if ((leaderboard.sortMode === LeaderboardSortMode.ASC && score < entry.score) || (leaderboard.sortMode === LeaderboardSortMode.DESC && score > entry.score)) {
              entry.score = score
              entry.createdAt = req.ctx.state.continuityDate ?? new Date()
              if (props) {
                entry.setProps(mergeAndSanitiseProps({ prevProps: entry.props.getItems(), newProps: props }))
              }

              updated = true
            }
          } else {
            // for non-unique leaderboards, create a new entry
            entry = this.createEntry({
              leaderboard,
              playerAlias: lockedAlias,
              score,
              continuityDate: req.ctx.state.continuityDate,
              props
            })
            await trx.persistAndFlush(entry)
          }
        } catch (err) {
          if (err instanceof NotFoundError || err instanceof UniqueLeaderboardEntryPropsDigestError) {
            // entry doesn't exist, create a new one
            entry = this.createEntry({
              leaderboard,
              playerAlias: lockedAlias,
              score,
              continuityDate: req.ctx.state.continuityDate,
              props
            })
            await trx.persistAndFlush(entry)
          } else if (err instanceof PropSizeError) {
            return { entry: null, updated: false, errorResponse: buildErrorResponse({ props: [err.message] }) }
          /* v8 ignore next 3 */
          } else {
            throw err
          }
        }

        return { entry, updated }
      })
    } catch (err) {
      if (err instanceof PropSizeError) {
        return buildErrorResponse({ props: [err.message] })
      }
      throw err
    }

    if (result.errorResponse) {
      return result.errorResponse
    }

    if (result.entry === null) {
      return buildErrorResponse({ props: ['Failed to create entry'] })
    }

    const { entry, updated } = result

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardEntryCreated(em, entry)
    })

    const query = em.qb(LeaderboardEntry)
      .where({
        leaderboard,
        hidden: false,
        deletedAt: null,
        score: leaderboard.sortMode === LeaderboardSortMode.ASC
          ? { $lte: entry.score }
          : { $gte: entry.score }
      })
      .orderBy({ createdAt: 'asc' })

    if (!req.ctx.state.includeDevData) {
      query.andWhere({
        playerAlias: {
          player: {
            devBuild: false
          }
        }
      })
    }

    const position = Math.max((await query.count()) - 1, 0)
    await entry.playerAlias.player.checkGroupMemberships(em)

    return {
      status: 200,
      body: {
        entry: { position, ...entry.toJSON() },
        updated
      }
    }
  }
}
