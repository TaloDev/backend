import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import Game from '../entities/game'
import APIKey, { APIKeyScope } from '../entities/api-key'
import { RequestContext, EntityManager } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import Redis from 'ioredis'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'
import Socket from '.'
import { SocketMessageResponse } from './messages/socketMessage'
import { logResponse } from './messages/socketLogger'
import { SocketErrorCode } from './messages/socketError'
import SocketTicket from './socketTicket'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { getSocketTracer } from './socketTracer'

export default class SocketConnection {
  alive: boolean = true
  playerAliasId!: number
  game: Game
  private apiKey: APIKey

  rateLimitKey: string = `requests.socket:${v4()}`
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
    const em = RequestContext.getEntityManager() as EntityManager
    /* v8 ignore next 3 */
    if (!em) {
      throw new Error('Missing request context for entity manager')
    }
    return em.repo(PlayerAlias).findOne(this.playerAliasId)
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
    // 60 rps for authed, 1 for unauthed
    return this.playerAliasId ? 3600 : 60
  }

  async checkRateLimitExceeded(redis: Redis): Promise<boolean> {
    const rateLimitExceeded = await checkRateLimitExceeded(redis, this.rateLimitKey, this.getRateLimitMaxRequests())

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
    await getSocketTracer().startActiveSpan('socket.send_message', async (span) => {
      if (this.ws.readyState === this.ws.OPEN) {
        const devBuild = this.isDevBuild()
        const message = JSON.stringify({
          res,
          data
        })

        setTraceAttributes({
          'socket.message_receiver.alias_id': this.playerAliasId,
          'socket.message_receiver.dev_build': devBuild
        })

        logResponse(this, res, message)

        await this.wss.trackEvent({
          eventType: res,
          reqOrRes: 'res',
          code: 'errorCode' in data ? (data.errorCode as SocketErrorCode) : null,
          gameId: this.game.id,
          playerAliasId: this.playerAliasId,
          devBuild: devBuild
        })

        this.ws.send(message)
      }

      span.end()
    })
  }

  async handleClosed(): Promise<void> {
    if (this.playerAliasId) {
      const playerAlias = await this.getPlayerAlias()
      if (playerAlias) {
        const em = RequestContext.getEntityManager() as EntityManager
        await playerAlias.player.handleSession(em, false)
        await playerAlias.player.setPresence(em, this.wss, playerAlias, false)
      }
    }
  }
}
