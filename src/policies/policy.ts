import { EntityManager } from '@mikro-orm/mysql'
import { Policy as ServicePolicy, PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { Context } from 'koa'
import APIKey, { APIKeyScope } from '../entities/api-key'
import Game from '../entities/game'
import User from '../entities/user'
import getUserFromToken from '../lib/auth/getUserFromToken'
import checkScope from './checkScope'

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

    try {
      const user = await getUserFromToken(ctx)
      ctx.state.user = user
      return user
    } catch {
      return ctx.throw(401)
    }
  }

  getAPIKey(): APIKey {
    return this.ctx.state.key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.repo(Game).findOne(gameId)
    if (!game) this.ctx.throw(404, 'Game not found')
    this.ctx.state.game = game

    const user = await this.getUser()
    return game.organisation.id === user.organisation.id
  }

  async hasScope(scope: APIKeyScope): Promise<PolicyResponse> {
    const key = this.getAPIKey()
    const hasScope = checkScope(key, scope)

    return hasScope || new PolicyDenial({ message: `Missing access key scope: ${scope}` })
  }

  async hasScopes(scopes: APIKeyScope[]): Promise<PolicyResponse> {
    const key = this.getAPIKey()
    const missing = scopes.filter((scope) => !checkScope(key, scope))

    return missing.length === 0 || new PolicyDenial({ message: `Missing access key scope(s): ${missing.join(', ')}` })
  }
}
