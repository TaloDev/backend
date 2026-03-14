import { RequestContext, EntityManager } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import { v4 } from 'uuid'
import { WebSocket } from 'ws'
import Socket from '.'
import { APIKeyScope } from '../entities/api-key'
import PlayerAlias from '../entities/player-alias'
import checkRateLimitExceeded from '../lib/errors/checkRateLimitExceeded'
import { logResponse } from './messages/socketLogger'
import { heartbeatMessage, SocketMessageResponse } from './messages/socketMessage'
import SocketTicket from './socketTicket'

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
    private readonly remoteAddress: string,
  ) {
    this.gameId = ticket.apiKey.game.id
    this.apiKeyId = ticket.apiKey.id
    this.apiKeyScopes = ticket.apiKey.scopes
    this.devBuild = ticket.devBuild
  }

  async getPlayerAlias() {
    const aliasKey = PlayerAlias.getSocketDataKey(this.playerAliasId)

    const cache = await this.wss.redis.get(aliasKey)
    if (cache) {
      return JSON.parse(cache) as ReturnType<PlayerAlias['toJSON']>
    }

    const em = RequestContext.getEntityManager() as EntityManager
    /* istanbul ignore next -- @preserve */
    if (!em) {
      throw new Error('Missing request context for entity manager')
    }

    const playerAlias = await em.repo(PlayerAlias).findOneOrFail(this.playerAliasId)
    const data = playerAlias.toJSON()
    await this.wss.redis.set(aliasKey, JSON.stringify(data), 'EX', 5)

    return data
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
    // 60 rps for authed, 5 for unauthed
    return this.playerAliasId ? 3600 : 300
  }

  async checkRateLimitExceeded(redis: Redis): Promise<boolean> {
    const rateLimitExceeded = await checkRateLimitExceeded(
      redis,
      this.rateLimitKey,
      this.getRateLimitMaxRequests(),
    )

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

  sendMessage<T extends object>(res: SocketMessageResponse, data: T, serialisedMessage?: string) {
    if (this.ws.readyState === this.ws.OPEN) {
      const message = serialisedMessage ?? JSON.stringify({ res, data })
      logResponse(this, res, message)
      this.ws.send(message)
    }
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
      const em = RequestContext.getEntityManager() as EntityManager
      const playerAlias = await em.repo(PlayerAlias).findOne(this.playerAliasId)

      if (playerAlias) {
        await playerAlias.player.handleSession(em, false)
        await playerAlias.player.setPresence(em, this.wss, playerAlias, false)
      }
    }
  }
}
