import { createClient } from '@clickhouse/client'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'

export default function createClickhouseClient(): NodeClickHouseClient {
  return createClient({
    url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/${process.env.CLICKHOUSE_DB}`
  })
}
