import { ClickHouseClient, createClient } from '@clickhouse/client'

export default function createClickHouseClient(): ClickHouseClient {
  return createClient({
    url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/${process.env.CLICKHOUSE_DB}`
  })
}
