import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'
import APIKey, { APIKeyScope } from '../entities/api-key'
import { RequestContext } from '@mikro-orm/core'
import { v4 } from 'uuid'
import Redis from 'ioredis'
import redisConfig from '../config/redis.config'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'
import Socket from '.'
import { SocketMessageResponse } from './messages/socketMessage'
import { logResponse } from './messages/socketLogger'
import { SocketErrorCode } from './messages/socketError'
import SocketTicket from './socketTicket'

export default class SocketConnection {
  alive: boolean = true
  playerAliasId: number
  game: Game
  private apiKey: APIKey

  rateLimitKey: string = v4()
  rateLimitWarnings: number = 0

  constructor(
    private readonly wss: Socket,
    private readonly ws: WebSocket,
    private readonly ticket: SocketTicket,
    private readonly remoteAddress: string
  ) {
    this.game = this.ticket.apiKey.game
    this.apiKey = this.ticket.apiKey
  }

  async getPlayerAlias(): Promise<PlayerAlias | null> {
    return RequestContext.getEntityManager()
      .getRepository(PlayerAlias)
      .findOne(this.playerAliasId, { refresh: true })
  }

  getAPIKeyId(): number {
    return this.ticket.apiKey.id
  }

  hasScope(scope: APIKeyScope): boolean {
    return this.apiKey.scopes.includes(APIKeyScope.FULL_ACCESS) || this.apiKey.scopes.includes(scope)
  }

  hasScopes(scopes: APIKeyScope[]): boolean {
    return this.hasScope(APIKeyScope.FULL_ACCESS) || scopes.every((scope) => this.hasScope(scope))
  }

  getRateLimitMaxRequests(): number {
    return this.playerAliasId ? 100 : 10
  }

  async checkRateLimitExceeded(): Promise<boolean> {
    const redis = new Redis(redisConfig)
    const rateLimitExceeded = await checkRateLimitExceeded(redis, this.rateLimitKey, this.getRateLimitMaxRequests())
    await redis.quit()

    if (rateLimitExceeded) {
      this.rateLimitWarnings++
    }

    return rateLimitExceeded
  }

  getRemoteAddress(): string {
    return this.remoteAddress
  }

  getSocket(): WebSocket {
    return this.ws
  }

  isDevBuild(): boolean {
    return this.ticket.devBuild
  }

  async sendMessage<T extends object>(res: SocketMessageResponse, data: T): Promise<void> {
    if (this.ws.readyState === this.ws.OPEN) {
      const message = JSON.stringify({
        res,
        data
      })

      logResponse(this, res, message)

      await this.wss.trackEvent('message', {
        eventType: res,
        reqOrRes: 'res',
        code: 'errorCode' in data ? (data.errorCode as SocketErrorCode) : null,
        gameId: this.game.id,
        playerAliasId: this.playerAliasId,
        devBuild: this.isDevBuild()
      })

      this.ws.send(message)
    }
  }
}
