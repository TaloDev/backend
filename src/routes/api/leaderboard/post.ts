import { NotFoundError } from '@mikro-orm/mysql'
import type { RejectedProp } from '../../../lib/props/sanitiseProps.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard.js'
import PlayerAlias from '../../../entities/player-alias.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import { UniqueLeaderboardEntryPropsDigestError } from '../../../lib/errors/uniqueLeaderboardEntryPropsDigestError.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import { withRedisLock } from '../../../lib/perf/redisLock.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
import { hardSanitiseProps, mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'
import { postDocs } from './docs.js'

function createEntry({
  leaderboard,
  playerAlias,
  score,
  continuityDate,
  props,
  profanityRejected,
}: {
  leaderboard: Leaderboard
  playerAlias: PlayerAlias
  score: number
  continuityDate?: Date
  props: { key: string; value: string }[]
  profanityRejected: RejectedProp[]
}) {
  const { accepted, rejected: sizeRejected } = hardSanitiseProps({ props })
  const allRejected = [...profanityRejected, ...sizeRejected]
  if (allRejected.length > 0) {
    throw new PropRejectionError(allRejected)
  }

  const entry = new LeaderboardEntry(leaderboard)
  entry.playerAlias = playerAlias
  entry.score = score
  if (continuityDate) {
    entry.createdAt = continuityDate
  }
  if (accepted.length > 0) {
    entry.setProps(accepted)
  }
  return entry
}

export const postRoute = apiRoute({
  method: 'post',
  path: '/:internalName/entries',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the leaderboard' }),
    }),
    body: z.object({
      score: z.number().meta({ description: 'A numeric score for the entry' }),
      props: z
        .array(
          z.object({
            key: z.string(),
            value: z.string().nullable(),
          }),
          { error: 'Props must be an array' },
        )
        .optional(),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_LEADERBOARDS]),
    loadLeaderboard,
    loadAlias,
  ),
  handler: async (ctx) => {
    const { score, props = [] } = ctx.state.validated.body
    const { accepted: acceptedProps, rejected: profanityRejected } = filterProfaneProps(
      props,
      ctx.state.game.blockPropsProfanity,
    )
    const em = ctx.em

    const leaderboard = ctx.state.leaderboard

    try {
      const result = await withRedisLock(
        { key: `locks:leaderboard-entry:${ctx.state.alias.id}:${ctx.state.leaderboard.id}` },
        () =>
          em.transactional(async (trx) => {
            const playerAlias = await trx.findOneOrFail(PlayerAlias, ctx.state.alias.id)

            let entry: LeaderboardEntry | null = null
            let updated = false

            // filter out props with null values for createEntry (only used for merging in updates)
            const createProps = acceptedProps.filter(
              (p): p is { key: string; value: string } => p.value !== null,
            )

            try {
              if (leaderboard.unique) {
                // try to find existing entry for unique leaderboards
                if (leaderboard.uniqueByProps) {
                  entry = await leaderboard.findEntryWithProps({
                    em: trx,
                    playerAliasId: playerAlias.id,
                    props: createProps,
                  })
                  if (!entry) {
                    throw new UniqueLeaderboardEntryPropsDigestError()
                  }
                } else {
                  entry = await trx.repo(LeaderboardEntry).findOneOrFail({
                    leaderboard,
                    playerAlias,
                    deletedAt: null,
                  })
                }

                // update entry if new score is better
                const shouldUpdate =
                  (leaderboard.sortMode === LeaderboardSortMode.ASC && score < entry.score) ||
                  (leaderboard.sortMode === LeaderboardSortMode.DESC && score > entry.score)

                if (shouldUpdate) {
                  entry.score = score
                  entry.createdAt = ctx.state.continuityDate ?? new Date()
                  if (acceptedProps.length > 0) {
                    const { accepted, rejected } = mergeAndSanitiseProps({
                      prevProps: entry.props.getItems(),
                      newProps: acceptedProps,
                    })
                    if (rejected.length > 0) {
                      throw new PropRejectionError([...profanityRejected, ...rejected])
                    }
                    entry.setProps(accepted)
                  }
                  updated = true
                }
              } else {
                // for non-unique leaderboards, always create a new entry
                entry = createEntry({
                  leaderboard,
                  playerAlias,
                  score,
                  continuityDate: ctx.state.continuityDate,
                  props: createProps,
                  profanityRejected,
                })
                await trx.persist(entry).flush()
              }
            } catch (err) {
              // if unique entry doesn't exist, create it
              if (
                err instanceof NotFoundError ||
                err instanceof UniqueLeaderboardEntryPropsDigestError
              ) {
                entry = createEntry({
                  leaderboard,
                  playerAlias,
                  score,
                  continuityDate: ctx.state.continuityDate,
                  props: createProps,
                  profanityRejected,
                })
                await trx.persist(entry).flush()
                /* v8 ignore next 3 -- @preserve */
              } else {
                throw err
              }
            }

            return { entry, updated }
          }),
      )

      const { entry, updated } = result

      await triggerIntegrations(em, leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryCreated(em, entry)
      })

      const query = em
        .qb(LeaderboardEntry)
        .where({
          leaderboard,
          hidden: false,
          deletedAt: null,
          score:
            leaderboard.sortMode === LeaderboardSortMode.ASC
              ? { $lte: entry.score }
              : { $gte: entry.score },
        })
        .orderBy({ createdAt: 'asc' })

      if (!ctx.state.includeDevData) {
        query.andWhere({
          playerAlias: {
            player: {
              devBuild: false,
            },
          },
        })
      }

      const { count } = await query.count().execute('get')
      const position = Math.max(count - 1, 0)
      await entry.playerAlias.player.checkGroupMemberships(em)

      return {
        status: 200,
        body: {
          entry: { position, ...entry.toJSON() },
          updated,
        },
      }
    } catch (err) {
      if (err instanceof PropRejectionError) {
        return buildErrorResponse({ props: [err.message] }, { rejectedProps: err.rejected })
      }
      throw err
    }
  },
})
