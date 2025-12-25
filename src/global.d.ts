import 'vitest'
import { EntityManager } from '@mikro-orm/mysql'
import Koa from 'koa'
import { ClickHouseClient } from '@clickhouse/client'
import { ClayDocs } from 'koa-clay'
import Redis from 'ioredis'
import { DocsRegistry } from './lib/hono-docs/registry'

declare global {
  // clay (legacy, will be removed)
  var clay: {
    docs: ClayDocs
  }

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
