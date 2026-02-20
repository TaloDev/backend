import { APIKeyScope } from '../../../entities/api-key'
import Player from '../../../entities/player'
import PlayerGameStatSnapshot, {
  ClickHousePlayerGameStatSnapshot,
} from '../../../entities/player-game-stat-snapshot'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadStat } from './common'
import { globalHistoryDocs } from './docs'

export const globalHistoryRoute = apiRoute({
  method: 'get',
  path: '/:internalName/global-history',
  docs: globalHistoryDocs,
  schema: (z) => ({
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
    }),
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      playerId: z
        .uuid()
        .optional()
        .meta({ description: 'A player ID to use when filtering snapshots' }),
      startDate: z.string().optional().meta({
        description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
      }),
      endDate: z.string().optional().meta({
        description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_STATS]), loadStat),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { page, startDate, endDate, playerId } = ctx.state.validated.query

    const em = ctx.em
    const clickhouse = ctx.clickhouse

    const stat = ctx.state.stat
    if (!stat.global) {
      return ctx.throw(400, 'This stat is not globally available')
    }

    let whereConditions = await stat.buildMetricsWhereConditions(startDate, endDate)

    if (playerId) {
      try {
        const player = await em.repo(Player).findOneOrFail(
          {
            id: playerId,
            game: stat.game,
          },
          { populate: ['aliases:ref'] },
        )
        whereConditions += ` AND player_alias_id IN (${player.aliases.getIdentifiers().join(', ')})`
      } catch {
        return ctx.throw(404, 'Player not found')
      }
    }

    const query = `
      SELECT *
      FROM player_game_stat_snapshots
      ${whereConditions}
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage + 1} OFFSET ${page * itemsPerPage}
    `

    const snapshots = await clickhouse
      .query({
        query,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<ClickHousePlayerGameStatSnapshot>())

    const history = await PlayerGameStatSnapshot.massHydrate(em, snapshots.slice(0, itemsPerPage))
    const [count, globalValue] = await stat.getGlobalValueMetrics(clickhouse, whereConditions)
    const playerValue = await stat.getPlayerValueMetrics(clickhouse, whereConditions)

    return {
      status: 200,
      body: {
        history,
        globalValue,
        playerValue,
        count,
        itemsPerPage,
        isLastPage: snapshots.length <= itemsPerPage,
      },
    }
  },
})
