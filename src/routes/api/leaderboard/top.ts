import { APIKeyScope } from '../../../entities/api-key.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import { getEntryPositions } from '../../../lib/leaderboards/getEntryPositions.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'
import { topDocs } from './docs.js'

const MAX_TOP_ENTRIES = 200

export const topRoute = apiRoute({
  method: 'get',
  path: '/:internalName/entries/top',
  docs: topDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the leaderboard' }),
    }),
    query: z.object({
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_TOP_ENTRIES)
        .meta({
          description: `The maximum number of entries to return in each list (max ${MAX_TOP_ENTRIES})`,
        }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_LEADERBOARDS]),
    loadLeaderboard,
    loadAlias,
  ),
  handler: async (ctx) => {
    const { limit } = ctx.state.validated.query
    const { leaderboard, includeDevData } = ctx.state

    const em = ctx.em

    const where = leaderboard.getBaseEntryFilters(includeDevData)

    const orderBy = leaderboard.getEntryOrder()

    const topEntries = await em.repo(LeaderboardEntry).find(where, {
      orderBy,
      limit,
    })

    const playerEntries = await em.repo(LeaderboardEntry).find(
      {
        ...where,
        playerAlias: {
          id: ctx.state.alias.id,
          ...(includeDevData ? {} : { player: { devBuild: false } }),
        },
      },
      { orderBy, limit },
    )

    const positions = await getEntryPositions({
      em,
      leaderboard,
      entries: playerEntries,
      includeDevData,
    })

    const mappedPlayerEntries = playerEntries.map((entry, idx) => ({
      position: positions[idx],
      ...entry.toJSON(),
    }))

    const mappedTopEntries = topEntries.map((entry, idx) => ({
      position: idx,
      ...entry.toJSON(),
    }))

    return {
      status: 200,
      body: {
        topEntries: mappedTopEntries,
        playerEntries: mappedPlayerEntries,
      },
    }
  },
})
