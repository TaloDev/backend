import type Koa from 'koa'
import type { EntityManager } from '@mikro-orm/mysql'
import type { ClickHouseClient } from '@clickhouse/client'
import type Redis from 'ioredis'
import type Socket from '../../socket'
import type { APIRouteState, ProtectedRouteState, PublicRouteState, RouteState } from './state'

type AppContext = {
  em: EntityManager
  redis: Redis
  clickhouse: ClickHouseClient
  wss: Socket
}

export type AppParameterizedContext<S extends RouteState> =
  Koa.ParameterizedContext<S> & AppContext

export type PublicRouteContext = AppParameterizedContext<PublicRouteState>
export type ProtectedRouteContext = AppParameterizedContext<ProtectedRouteState>
export type APIRouteContext = AppParameterizedContext<APIRouteState>
