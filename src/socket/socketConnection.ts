import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'
import APIKey, { APIKeyScope } from '../entities/api-key'
import { IncomingHttpHeaders, IncomingMessage } from 'http'
import { RequestContext } from '@mikro-orm/core'
import jwt from 'jsonwebtoken'

export default class SocketConnection {
  alive: boolean = true
  playerAliasId: number | null = null
  game: Game | null = null
  scopes: APIKeyScope[] = []
  private headers: IncomingHttpHeaders = {}

  constructor(readonly ws: WebSocket, apiKey: APIKey, req: IncomingMessage) {
    this.game = apiKey.game
    this.scopes = apiKey.scopes
    this.headers = req.headers
  }

  async getPlayerAlias(): Promise<PlayerAlias | null> {
    return RequestContext.getEntityManager()
      .getRepository(PlayerAlias)
      .findOne(this.playerAliasId, { refresh: true })
  }

  getAPIKeyId(): number {
    const token = this.headers.authorization.split('Bearer ')[1]
    const decodedToken = jwt.decode(token)
    return decodedToken.sub
  }

  hasScope(scope: APIKeyScope): boolean {
    return this.scopes.includes(APIKeyScope.FULL_ACCESS) || this.scopes.includes(scope)
  }

  hasScopes(scopes: APIKeyScope[]): boolean {
    if (this.hasScope(APIKeyScope.FULL_ACCESS)) {
      return true
    }
    return scopes.every((scope) => this.hasScope(scope))
  }
}
