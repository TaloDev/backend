import { EntityManager } from '@mikro-orm/mysql'
import type Prop from '../../../entities/prop.js'
import type { RejectedProp, UnsanitisedProp } from '../../../lib/props/sanitiseProps.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard.js'
import PlayerAlias from '../../../entities/player-alias.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
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

type EntryWriteResult = {
  entry: LeaderboardEntry
  created: boolean
  updated: boolean
}

type CreateEntryParams = {
  leaderboard: Leaderboard
  playerAlias: PlayerAlias
  score: number
  continuityDate?: Date
  props: Prop[]
  profanityRejected: RejectedProp[]
}

type WriteEntryParams = {
  em: EntityManager
  leaderboard: Leaderboard
  playerAliasId: number
  score: number
  continuityDate?: Date
  props: Prop[]
  acceptedProps: UnsanitisedProp[]
  profanityRejected: RejectedProp[]
  onlyDeleted?: boolean
}

function createEntry({
  leaderboard,
  playerAlias,
  score,
  continuityDate,
  props,
  profanityRejected,
}: CreateEntryParams) {
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

function isBetterScore(leaderboard: Leaderboard, score: number, currentScore: number) {
  return leaderboard.sortMode === LeaderboardSortMode.ASC
    ? score < currentScore
    : score > currentScore
}

async function findUniqueEntry({
  em,
  leaderboard,
  playerAliasId,
  props,
  onlyDeleted,
}: {
  em: EntityManager
  leaderboard: Leaderboard
  playerAliasId: number
  props: Prop[]
  onlyDeleted?: boolean
}) {
  if (leaderboard.uniqueByProps) {
    return leaderboard.findEntryWithProps({ em, playerAliasId, props, onlyDeleted })
  }

  return em.repo(LeaderboardEntry).findOne({
    leaderboard,
    playerAlias: playerAliasId,
    deletedAt: onlyDeleted ? { $ne: null } : null,
  })
}

async function writeEntry({
  em,
  leaderboard,
  playerAliasId,
  score,
  continuityDate,
  props,
  acceptedProps,
  profanityRejected,
  onlyDeleted,
}: WriteEntryParams): Promise<EntryWriteResult> {
  return em.transactional(async (trx) => {
    const playerAlias = await trx.findOneOrFail(PlayerAlias, playerAliasId)

    const existing = leaderboard.unique
      ? await findUniqueEntry({
          em: trx,
          leaderboard,
          playerAliasId: playerAlias.id,
          props,
          onlyDeleted,
        })
      : null

    // non-unique boards always create; unique boards create when nothing matches
    if (!existing) {
      const entry = createEntry({
        leaderboard,
        playerAlias,
        score,
        continuityDate,
        props,
        profanityRejected,
      })
      await trx.persist(entry).flush()
      return { entry, created: true, updated: false }
    }

    // only a better score may change an existing entry
    if (!isBetterScore(leaderboard, score, existing.score)) {
      return { entry: existing, created: false, updated: false }
    }

    existing.score = score
    existing.createdAt = continuityDate ?? new Date()
    if (acceptedProps.length > 0) {
      const { accepted, rejected } = mergeAndSanitiseProps({
        prevProps: existing.props.getItems(),
        newProps: acceptedProps,
      })
      if (rejected.length > 0) {
        throw new PropRejectionError([...profanityRejected, ...rejected])
      }
      existing.setProps(accepted)
    }

    return { entry: existing, created: false, updated: true }
  })
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

    // filter out props with null values for createEntry (only used for merging in updates)
    const createProps = acceptedProps.filter((p): p is Prop => p.value !== null)
    const onlyDeleted =
      ctx.state.continuityDate && !leaderboard.isDateInCurrentPeriod(ctx.state.continuityDate)

    try {
      let result: EntryWriteResult | null = null

      // a submission that cannot change the entry returns it without locking or transacting
      if (leaderboard.unique) {
        const existing = await findUniqueEntry({
          em,
          leaderboard,
          playerAliasId: ctx.state.alias.id,
          props: createProps,
          onlyDeleted,
        })
        if (existing && !isBetterScore(leaderboard, score, existing.score)) {
          result = { entry: existing, created: false, updated: false }
        }
      }

      if (!result) {
        const writeParams: WriteEntryParams = {
          em,
          leaderboard,
          playerAliasId: ctx.state.alias.id,
          score,
          continuityDate: ctx.state.continuityDate,
          props: createProps,
          acceptedProps,
          profanityRejected,
          onlyDeleted,
        }

        // non-unique boards create an entry per submission, so they never queue on the lock
        result = leaderboard.unique
          ? await withRedisLock(
              { key: `locks:leaderboard-entry:${ctx.state.alias.id}:${ctx.state.leaderboard.id}` },
              () => writeEntry(writeParams),
            )
          : await writeEntry(writeParams)
      }

      const { entry, created, updated } = result

      if (created || updated) {
        await triggerIntegrations(em, leaderboard.game, (integration) => {
          return integration.handleLeaderboardEntryCreated(em, entry)
        })
      }

      const position = await leaderboard.getEntryPosition({
        em,
        entry,
        includeDevData: ctx.state.includeDevData,
      })
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
