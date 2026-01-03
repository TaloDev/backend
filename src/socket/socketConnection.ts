import { WebSocket } from 'ws'
import PlayerAlias from '../entities/player-alias'
import { APIKeyScope } from '../entities/api-key'
import { RequestContext, EntityManager } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import Redis from 'ioredis'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'
import Socket from '.'
import { heartbeatMessage, SocketMessageResponse } from './messages/socketMessage'
import { logResponse } from './messages/socketLogger'
import SocketTicket from './socketTicket'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { getSocketTracer } from './socketTracer'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'

export default class SocketConnection {
  alive: boolean = true
  playerAliasId!: number
  readonly gameId: number
  private readonly apiKeyId: number
  private readonly apiKeyScopes: APIKeyScope[]
  private readonly devBuild: boolean

  rateLimitKey: string = `requests.socket:${v4()}`
  rateLimitWarnings: number = 0

  constructor(
    private readonly wss: Socket,
    private readonly ws: WebSocket,
    ticket: SocketTicket,
    private readonly remoteAddress: string
  ) {
    this.gameId = ticket.apiKey.game.id
    this.apiKeyId = ticket.apiKey.id
    this.apiKeyScopes = ticket.apiKey.scopes
    this.devBuild = ticket.devBuild
  }

  async getPlayerAlias() {
    const em = RequestContext.getEntityManager() as EntityManager
    /* v8 ignore next 3 */
    if (!em) {
      throw new Error('Missing request context for entity manager')
    }
    return em.repo(PlayerAlias).findOne(
      this.playerAliasId,
      getResultCacheOptions(`socket-connection-alias-${this.playerAliasId}`, 1000)
    )
  }

  getAPIKeyId() {
    return this.apiKeyId
  }

  hasScope(scope: APIKeyScope) {
    return this.apiKeyScopes.includes(APIKeyScope.FULL_ACCESS) || this.apiKeyScopes.includes(scope)
  }

  hasScopes(scopes: APIKeyScope[]) {
    return this.hasScope(APIKeyScope.FULL_ACCESS) || scopes.every((scope) => this.hasScope(scope))
  }

  getRateLimitMaxRequests() {
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

  getRemoteAddress() {
    return this.remoteAddress
  }

  getSocket() {
    return this.ws
  }

  isDevBuild() {
    return this.devBuild
  }

  async sendMessage<T extends object>(res: SocketMessageResponse, data: T, serialisedMessage?: string) {
    await getSocketTracer().startActiveSpan('socket.send_message', async (span) => {
      try {
        if (this.ws.readyState === this.ws.OPEN) {
          const devBuild = this.isDevBuild()
          const message = serialisedMessage ?? JSON.stringify({ res, data })

          setTraceAttributes({
            'socket.message_receiver.alias_id': this.playerAliasId,
            'socket.message_receiver.dev_build': devBuild
          })

          logResponse(this, res, message)

          this.ws.send(message)
        }
      } finally {
        span.end()
      }
    })
  }

  ping() {
    this.alive = false
    this.ws.ping()
  }

  handleHeartbeat(asPing = false) {
    this.alive = true
    if (this.rateLimitWarnings > 0) {
      this.rateLimitWarnings--
    }

    if (asPing) {
      this.ws.send(heartbeatMessage)
    }
  }

  async handleClosed() {
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
