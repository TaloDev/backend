import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'
import APIKey, { APIKeyScope } from '../entities/api-key'

export default class SocketConnection {
  alive: boolean = true
  playerAlias: PlayerAlias | null = null
  game: Game | null = null
  scopes: APIKeyScope[] = []

  constructor(readonly ws: WebSocket, apiKey: APIKey) {
    this.game = apiKey.game
    this.scopes = apiKey.scopes
  }
}
