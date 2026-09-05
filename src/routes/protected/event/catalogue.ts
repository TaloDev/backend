import { ClickHouseClient } from '@clickhouse/client'
import { z } from 'zod'
import { getGlobalRedis } from '../../../config/redis.config.js'
import EventRetention from '../../../entities/event-retention.js'
import Event from '../../../entities/event.js'
import Game from '../../../entities/game.js'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { pageSchema } from '../../../lib/validation/pageSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'

type CatalogueClickHouseEvent = { name: string; count: string; players: string }

type CatalogueClickHouseEventProp = {
  name: string
  prop_keys: string[]
}

type CatalogueEvent = {
  name: string
  count: number
  players: number
  propKeys: string[]
  retentionDays: number | null
}

type Aggregations = {
  counts: CatalogueClickHouseEvent[]
  props: CatalogueClickHouseEventProp[]
}

async function fetchCounts(
  clickhouse: ClickHouseClient,
  gameId: number,
  includeDevData: boolean,
): Promise<CatalogueClickHouseEvent[]> {
  let query = `
    SELECT
      name,
      count() AS count,
      uniqExact(player_alias_id) AS players
    FROM events
    WHERE game_id = {gameId:UInt32}
  `

  if (!includeDevData) {
    query += ' AND dev_build = false'
  }

  query += ' GROUP BY name'

  return clickhouse
    .query({ query, query_params: { gameId }, format: 'JSONEachRow' })
    .then((res) => res.json<CatalogueClickHouseEvent>())
}

async function fetchPropKeys(
  clickhouse: ClickHouseClient,
  gameId: number,
  includeDevData: boolean,
): Promise<CatalogueClickHouseEventProp[]> {
  let query = `
    SELECT
      e.name AS name,
      groupUniqArray(p.prop_key) AS prop_keys
    FROM event_props p
    INNER JOIN events e ON e.id = p.event_id
    WHERE p.game_id = {gameId:UInt32}
  `

  if (!includeDevData) {
    query += ' AND p.dev_build = false'
  }

  query += ' GROUP BY name'

  return clickhouse
    .query({ query, query_params: { gameId }, format: 'JSONEachRow' })
    .then((res) => res.json<CatalogueClickHouseEventProp>())
}

async function fetchAggregations(
  game: Game,
  clickhouse: ClickHouseClient,
  includeDevData: boolean,
): Promise<Aggregations> {
  const redis = getGlobalRedis()
  const key = Event.getCatalogueCacheKey({ game, includeDevData })

  try {
    const cached = await redis.get(key)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // cache read failure falls through to ClickHouse
  }

  const [counts, props] = await Promise.all([
    fetchCounts(clickhouse, game.id, includeDevData),
    fetchPropKeys(clickhouse, game.id, includeDevData),
  ])
  const aggregations = { counts, props }

  try {
    await redis.set(key, JSON.stringify(aggregations), 'EX', 60)
  } catch {
    // cache write failure shouldn't block the response
  }

  return aggregations
}

export const catalogueRoute = protectedRoute({
  method: 'get',
  path: '/catalogue',
  schema: () => ({
    query: z.object({
      page: pageSchema,
    }),
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const clickhouse = ctx.clickhouse
    const includeDevData = ctx.state.includeDevData
    const { page } = ctx.state.validated.query

    const [{ counts, props }, retentions] = await Promise.all([
      fetchAggregations(ctx.state.game, clickhouse, includeDevData),
      ctx.em.repo(EventRetention).find({ game: ctx.state.game }),
    ])

    const retentionDaysByEvent = new Map(retentions.map((r) => [r.eventName, r.retentionDays]))
    const propKeysByEvent = new Map(props.map((p) => [p.name, p.prop_keys.sort()]))

    // union so configured events show up even if all their rows are expired
    const eventNames = new Set([...counts.map((c) => c.name), ...retentionDaysByEvent.keys()])

    const countByEvent = new Map(counts.map((c) => [c.name, c]))
    const catalogue: CatalogueEvent[] = Array.from(eventNames).map((name) => {
      const count = countByEvent.get(name)

      return {
        name,
        count: count ? Number(count.count) : 0,
        players: count ? Number(count.players) : 0,
        propKeys: propKeysByEvent.get(name) ?? [],
        retentionDays: retentionDaysByEvent.get(name) ?? null,
      }
    })

    catalogue.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    const start = page * DEFAULT_PAGE_SIZE
    const events = catalogue.slice(start, start + DEFAULT_PAGE_SIZE)

    return {
      status: 200,
      body: {
        events,
        count: catalogue.length,
        itemsPerPage: DEFAULT_PAGE_SIZE,
        isLastPage: start + events.length >= catalogue.length,
      },
    }
  },
})
