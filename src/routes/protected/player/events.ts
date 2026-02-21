import Event, { ClickHouseEvent } from '../../../entities/event'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { loadPlayer } from './common'

export const eventsRoute = protectedRoute({
  method: 'get',
  path: '/:id/events',
  schema: (z) => ({
    query: z.object({
      search: z.string().optional(),
      page: pageSchema,
    }),
  }),
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const { search, page } = ctx.state.validated.query
    const player = ctx.state.player

    const em = ctx.em
    const clickhouse = ctx.clickhouse

    const searchQuery = search
      ? 'AND (e.name ILIKE {search: String} OR e.id IN (SELECT event_id FROM event_props WHERE prop_value ILIKE {search: String}))'
      : ''

    const baseQuery = `FROM events e
      WHERE e.player_alias_id IN ({aliasIds:Array(UInt32)})
        ${searchQuery}`

    const query = `
      WITH filtered_events AS (
        SELECT e.*
        ${baseQuery}
      )
      SELECT
        *,
        count(*) OVER() as total_count
      FROM filtered_events
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage}
      OFFSET ${page * itemsPerPage}
    `

    const results = await clickhouse
      .query({
        query,
        query_params: {
          search: `%${search}%`,
          aliasIds: player.aliases.getItems().map((alias) => alias.id),
        },
        format: 'JSONEachRow',
      })
      .then((res) => res.json<ClickHouseEvent & { total_count: string }>())

    const events = await Event.massHydrate(em, results, clickhouse, true)
    const count = results.length > 0 ? Number(results[0].total_count) : 0

    return {
      status: 200,
      body: {
        events,
        count,
        itemsPerPage,
      },
    }
  },
})
