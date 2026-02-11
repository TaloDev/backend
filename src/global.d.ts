import 'vitest'
import { EntityManager } from '@mikro-orm/mysql'
import Koa from 'koa'
import { ClickHouseClient } from '@clickhouse/client'
import Redis from 'ioredis'
import { DocsRegistry } from './lib/docs/docs-registry'

declare global {
  var talo: {
    docs: DocsRegistry
  }

  // tests
  var app: ReturnType<Koa['callback']>
  var ctx: ReturnType<Koa['context']>
  var em: EntityManager
  var clickhouse: ClickHouseClient
  var redis: Redis
}

export {}
