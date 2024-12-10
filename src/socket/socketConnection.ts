import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'
import APIKey, { APIKeyScope } from '../entities/api-key'
import { IncomingHttpHeaders, IncomingMessage } from 'http'

export default class SocketConnection {
  alive: boolean = true
  playerAlias: PlayerAlias | null = null
  game: Game | null = null
  scopes: APIKeyScope[] = []
  headers: IncomingHttpHeaders = {}

  constructor(readonly ws: WebSocket, apiKey: APIKey, req: IncomingMessage) {
    this.game = apiKey.game
    this.scopes = apiKey.scopes
    this.headers = req.headers
  }

  getPlayerFromHeader(): string | null {
    return this.headers['x-talo-player'] as string ?? null
  }

  getAliasFromHeader(): number | null {
    return this.headers['x-talo-alias'] ? Number(this.headers['x-talo-alias']) : null
  }
}
