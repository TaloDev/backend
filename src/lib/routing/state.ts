import type APIKey from '../../entities/api-key'
import type Game from '../../entities/game'
import type User from '../../entities/user'

export type PublicRouteState = Record<string, never>

export type ProtectedRouteState = {
  jwt: {
    sub: number
    api?: boolean
  }
  user: User
  includeDevData: boolean
}

export type APIRouteState = {
  jwt: {
    sub: number
    api: true
  }
  key: APIKey
  game: Game
  includeDevData: boolean
  devBuild: boolean
  currentPlayerId?: string
  currentAliasId?: number
  continuityDate?: Date
}

export type RouteState = PublicRouteState | ProtectedRouteState | APIRouteState
