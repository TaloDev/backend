import { EntityManager } from '@mikro-orm/core'
import { Policy as ServicePolicy, PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { Context } from 'koa'
import APIKey, { APIKeyScope } from '../entities/api-key'
import Game from '../entities/game'
import User from '../entities/user'
import getUserFromToken from '../lib/auth/getUserFromToken'

export default class Policy extends ServicePolicy {
  em: EntityManager

  constructor(ctx: Context) {
    super(ctx)
    this.em = ctx.em
  }

  isAPICall(): boolean {
    return this.ctx.state.user.api === true
  }

  async getUser(req?: Request): Promise<User> {
    const ctx = req ? req.ctx : this.ctx

    // check its been initialised
    if (ctx.state.user.email) return ctx.state.user

    const user = await getUserFromToken(ctx)
    if (!user) ctx.throw(401)

    ctx.state.user = user
    return user
  }

  async getAPIKey(): Promise<APIKey> {
    if (this.ctx.state.key) return this.ctx.state.key

    const key = await (<EntityManager> this.ctx.em).getRepository(APIKey).findOne(this.ctx.state.user.sub, { populate: ['game'] })
    if (!key || key.revokedAt) this.ctx.throw(401, 'Invalid or missing access key')

    this.ctx.state.key = key
    return key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.getRepository(Game).findOne(gameId, { populate: ['organisation'] })
    if (!game) this.ctx.throw(404, 'Game not found')
    this.ctx.state.game = game

    const user = await this.getUser()
    return game.organisation.id === user.organisation.id
  }

  async hasScope(scope: string): Promise<PolicyResponse> {
    const key = await this.getAPIKey()
    const hasScope = key.scopes.includes(scope as APIKeyScope)

    return hasScope || new PolicyDenial({ message: `Missing access key scope: ${scope}` })
  }

  async hasScopes(scopes: string[]): Promise<PolicyResponse> {
    const key = await this.getAPIKey()
    const missing = scopes.filter((scope) => !key.scopes.includes(scope as APIKeyScope))

    return missing.length === 0 || new PolicyDenial({ message: `Missing access key scope(s): ${missing.join(', ')}` })
  }
}
