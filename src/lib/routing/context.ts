import type { ClickHouseClient } from '@clickhouse/client'
import type { EntityManager } from '@mikro-orm/mysql'
import type Redis from 'ioredis'
import type Koa from 'koa'
import type Socket from '../../socket'
import type { APIRouteState, ProtectedRouteState, PublicRouteState, RouteState } from './state'

type AppContext = {
  em: EntityManager
  redis: Redis
  clickhouse: ClickHouseClient
  wss: Socket
  params: Record<string, string>
}

export type AppParameterizedContext<S extends RouteState> = Koa.ParameterizedContext<S> & AppContext

type ExtendedRouteContext = Record<string, unknown>

export type GlobalContext<T = ExtendedRouteContext> = AppParameterizedContext<RouteState & T>
export type PublicRouteContext<T = ExtendedRouteContext> = AppParameterizedContext<
  PublicRouteState & T
>
export type ProtectedRouteContext<T = ExtendedRouteContext> = AppParameterizedContext<
  ProtectedRouteState & T
>
export type APIRouteContext<T = ExtendedRouteContext> = AppParameterizedContext<APIRouteState & T>
