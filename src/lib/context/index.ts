import type Koa from 'koa'
import type { EntityManager } from '@mikro-orm/mysql'
import type { ClickHouseClient } from '@clickhouse/client'
import type Redis from 'ioredis'
import type APIKey from '../../entities/api-key'
import type Game from '../../entities/game'
import type User from '../../entities/user'
import type Socket from '../../socket'

type AppContext = {
  em: EntityManager
  redis: Redis
  clickhouse: ClickHouseClient
  wss: Socket
}

export type PublicRouteState = Record<string, never>

export type ProtectedRouteState = {
  user: User
}
export type APIRouteState = {
  key: APIKey
  game: Game
}

export type AppParameterizedContext<S = PublicRouteState> =
  Koa.ParameterizedContext<S> & AppContext
