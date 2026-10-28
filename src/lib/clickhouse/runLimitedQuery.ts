import { ClickHouseClient, ClickHouseError } from '@clickhouse/client'

export const CLICKHOUSE_QUERY_SETTINGS = {
  max_execution_time: 30,
  max_rows_to_read: '50000000',
  max_memory_usage: '1000000000',
} as const

// error types ClickHouse reports when a query breaches CLICKHOUSE_QUERY_SETTINGS
const RESOURCE_LIMIT_ERROR_TYPES = new Set([
  'TIMEOUT_EXCEEDED',
  'TOO_MANY_ROWS',
  'TOO_MANY_ROWS_OR_BYTES',
  'TOO_SLOW',
  'MEMORY_LIMIT_EXCEEDED',
])

export class QueryLimitError extends Error {
  status = 400

  constructor(limitType: string) {
    super(`Query hit the ClickHouse ${limitType} limit, narrow the request or date range`)
    this.name = 'QueryLimitError'
  }
}

export async function runLimitedQuery<T>({
  clickhouse,
  query,
  params,
}: {
  clickhouse: ClickHouseClient
  query: string
  params: Record<string, unknown>
}): Promise<T[]> {
  try {
    return await clickhouse
      .query({
        query,
        query_params: params,
        clickhouse_settings: CLICKHOUSE_QUERY_SETTINGS,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<T>())
  } catch (err) {
    if (err instanceof ClickHouseError && err.type && RESOURCE_LIMIT_ERROR_TYPES.has(err.type)) {
      throw new QueryLimitError(err.type)
    }

    throw err
  }
}
