import { EntityManager } from '@mikro-orm/mysql'
import { ClickHouseClient } from '@clickhouse/client'
import Redis from 'ioredis'
import APIKey from '../../entities/api-key'
import Game from '../../entities/game'
import User from '../../entities/user'
import Socket from '../../socket'

export type BaseContext = {
  Variables: {
    em: EntityManager
    redis: Redis
    clickhouse: ClickHouseClient
    wss: Socket
  }
}

export type PublicRouteContext = BaseContext

export type ProtectedRouteContext = {
  Variables: BaseContext['Variables'] & {
    user: User
  }
}

export type APIRouteContext = {
  Variables: BaseContext['Variables'] & {
    key: APIKey
    game: Game
  }
}
