import { APIKeyScope } from '../../../entities/api-key'
import PlayerGameStatSnapshot, {
  ClickHousePlayerGameStatSnapshot,
} from '../../../entities/player-game-stat-snapshot'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { loadPlayer } from '../../../middleware/player-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadStatWithPlayer } from './common'
import { historyDocs } from './docs'

export const historyRoute = apiRoute({
  method: 'get',
  path: '/:internalName/history',
  docs: historyDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
    }),
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      startDate: z
        .string()
        .optional()
        .meta({
          description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
        }),
      endDate: z
        .string()
        .optional()
        .meta({
          description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
        }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_STATS]),
    loadPlayer,
    loadStatWithPlayer,
  ),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { page, startDate, endDate } = ctx.state.validated.query

    const em = ctx.em
    const clickhouse = ctx.clickhouse

    const stat = ctx.state.stat
    const player = ctx.state.player

    const whereConditions = await stat.buildMetricsWhereConditions(startDate, endDate, player)

    const query = `
      WITH (SELECT count() FROM player_game_stat_snapshots ${whereConditions}) AS count
      SELECT *, count
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
      .then((res) => res.json<ClickHousePlayerGameStatSnapshot & { count: string }>())

    const count = Number(snapshots[0]?.count ?? 0)
    const history = await PlayerGameStatSnapshot.massHydrate(em, snapshots.slice(0, itemsPerPage))

    return {
      status: 200,
      body: {
        history,
        count,
        itemsPerPage,
        isLastPage: snapshots.length <= itemsPerPage,
      },
    }
  },
})
