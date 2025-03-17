/* eslint-disable no-var */
import 'vitest'
import { EntityManager } from '@mikro-orm/mysql'
import Koa from 'koa'
import { ClickHouseClient } from '@clickhouse/client'
import { ClayDocs } from 'koa-clay'

declare global {
  // clay
  var clay: {
    docs: ClayDocs
  }
  // tests
  var app: ReturnType<Koa['callback']>
  var ctx: ReturnType<Koa['context']>
  var em: EntityManager
  var clickhouse: ClickHouseClient
}

export {}
