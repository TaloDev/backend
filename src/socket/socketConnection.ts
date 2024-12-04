import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'

export default class SocketConnection {
  playerAlias: PlayerAlias | null = null
  alive: boolean = true

  constructor(readonly ws: WebSocket, readonly game: Game) {}
}
