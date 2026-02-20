import { NotFoundError, LockMode } from '@mikro-orm/mysql'
import { APIKeyScope } from '../../../entities/api-key'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import PlayerAlias from '../../../entities/player-alias'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import { UniqueLeaderboardEntryPropsDigestError } from '../../../lib/errors/uniqueLeaderboardEntryPropsDigestError'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { hardSanitiseProps, mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadLeaderboard } from './common'
import { postDocs } from './docs'

function createEntry({
  leaderboard,
  playerAlias,
  score,
  continuityDate,
  props,
}: {
  leaderboard: Leaderboard
  playerAlias: PlayerAlias
  score: number
  continuityDate?: Date
  props: { key: string; value: string }[]
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
    const em = ctx.em

    const leaderboard = ctx.state.leaderboard

    const result = await em.transactional(async (trx) => {
      // lock the alias to prevent concurrent entry creation
      const lockedAlias = await trx.findOneOrFail(PlayerAlias, ctx.state.alias.id, {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      })

      let entry: LeaderboardEntry | null = null
      let updated = false

      // filter out props with null values for createEntry (only used for merging in updates)
      const createProps = props.filter((p): p is { key: string; value: string } => p.value !== null)

      try {
        if (leaderboard.unique) {
          // try to find existing entry for unique leaderboards
          if (leaderboard.uniqueByProps) {
            entry = await leaderboard.findEntryWithProps({
              em: trx,
              playerAliasId: lockedAlias.id,
              props: createProps,
            })
            if (!entry) {
              throw new UniqueLeaderboardEntryPropsDigestError()
            }
          } else {
            entry = await trx.repo(LeaderboardEntry).findOneOrFail({
              leaderboard,
              playerAlias: lockedAlias,
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
            if (props.length > 0) {
              entry.setProps(
                mergeAndSanitiseProps({ prevProps: entry.props.getItems(), newProps: props }),
              )
            }
            updated = true
          }
        } else {
          // for non-unique leaderboards, always create a new entry
          entry = createEntry({
            leaderboard,
            playerAlias: lockedAlias,
            score,
            continuityDate: ctx.state.continuityDate,
            props: createProps,
          })
          await trx.persistAndFlush(entry)
        }
      } catch (err) {
        // handle PropSizeError from setProps or createEntry
        if (err instanceof PropSizeError) {
          return {
            entry: null,
            updated: false,
            errorResponse: buildErrorResponse({ props: [err.message] }),
          }
        }

        // if unique entry doesn't exist, create it
        if (err instanceof NotFoundError || err instanceof UniqueLeaderboardEntryPropsDigestError) {
          try {
            entry = createEntry({
              leaderboard,
              playerAlias: lockedAlias,
              score,
              continuityDate: ctx.state.continuityDate,
              props: createProps,
            })
            await trx.persistAndFlush(entry)
          } catch (createErr) {
            // handle PropSizeError from creating new entry
            if (createErr instanceof PropSizeError) {
              return {
                entry: null,
                updated: false,
                errorResponse: buildErrorResponse({ props: [createErr.message] }),
              }
            }
            throw createErr
          }
        } else {
          throw err
        }
      }

      return { entry, updated }
    })

    if (result.errorResponse) {
      return result.errorResponse
    }

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

    const position = Math.max((await query.count()) - 1, 0)
    await entry.playerAlias.player.checkGroupMemberships(em)

    return {
      status: 200,
      body: {
        entry: { position, ...entry.toJSON() },
        updated,
      },
    }
  },
})
