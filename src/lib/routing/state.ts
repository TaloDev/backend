import type APIKey from '../../entities/api-key'
import type User from '../../entities/user'
import type Game from '../../entities/game'

export type PublicRouteState = Record<string, never>

export type ProtectedRouteState = {
  // TODO move to jwt or accessToken
  user: {
    sub: number
    api?: boolean
  }
  authenticatedUser: User
  includeDevData: boolean
}

export type APIRouteState = {
  key: APIKey
  game: Game
  includeDevData: boolean
}

export type RouteState = PublicRouteState | ProtectedRouteState | APIRouteState
