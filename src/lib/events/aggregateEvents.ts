import { ClickHouseClient } from '@clickhouse/client'
import { eventRangeParams, eventRangeWhere } from '../clickhouse/eventRange.js'
import { runLimitedQuery } from '../clickhouse/runLimitedQuery.js'
import { bucketExpression, bucketStarts, EventInterval, nextBucketStart } from './interval.js'

type EventBucket = {
  start: string
  end: string
  count: number
}

type EventSeries = {
  name: string | null
  buckets: EventBucket[]
}

type ClickHouseCountRow = {
  bucket: number
  count: string
}

type ClickHouseNamedCountRow = ClickHouseCountRow & {
  name: string
}

// Counts grouped into fixed buckets. `names` produces one zero-filled series per
// event name; without it there's a single series (name null) over every event in
// the game.
export async function aggregateEventCounts({
  clickhouse,
  gameId,
  from,
  to,
  interval,
  names,
  includeDevData,
}: {
  clickhouse: ClickHouseClient
  gameId: number
  from: Date
  to: Date
  interval: EventInterval
  names?: string[]
  includeDevData: boolean
}): Promise<EventSeries[]> {
  const starts = bucketStarts(from, to, interval)
  const bucketExpr = bucketExpression(interval)

  const rangeParams = eventRangeParams({ gameId, from, to })
  const where = `FROM events WHERE ${eventRangeWhere(includeDevData)}`

  if (!names) {
    const rows = await runLimitedQuery<ClickHouseCountRow>({
      clickhouse,
      query: `
        SELECT toUnixTimestamp(${bucketExpr}) * 1000 AS bucket, count() AS count
        ${where}
        GROUP BY bucket
      `,
      params: rangeParams,
    })

    const counts = new Map(rows.map((row) => [Number(row.bucket), Number(row.count)]))
    return [{ name: null, buckets: zeroFill(starts, interval, counts) }]
  }

  const rows = await runLimitedQuery<ClickHouseNamedCountRow>({
    clickhouse,
    query: `
      SELECT toUnixTimestamp(${bucketExpr}) * 1000 AS bucket, name, count() AS count
      ${where}
        AND name IN {names:Array(String)}
      GROUP BY bucket, name
    `,
    params: { ...rangeParams, names },
  })

  const countsBySeries = new Map<string, Map<number, number>>()
  for (const row of rows) {
    const counts = countsBySeries.get(row.name) ?? new Map<number, number>()
    counts.set(Number(row.bucket), Number(row.count))
    countsBySeries.set(row.name, counts)
  }

  return names.map((name) => ({
    name,
    buckets: zeroFill(starts, interval, countsBySeries.get(name) ?? new Map()),
  }))
}

// Builds one entry per bucket, defaulting empty buckets to 0.
function zeroFill(
  starts: Date[],
  interval: EventInterval,
  counts: Map<number, number>,
): EventBucket[] {
  return starts.map((start) => ({
    start: start.toISOString(),
    end: nextBucketStart(start, interval).toISOString(),
    count: counts.get(start.getTime()) ?? 0,
  }))
}
