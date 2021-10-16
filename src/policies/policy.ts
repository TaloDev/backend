import { EntityManager } from '@mikro-orm/core'
import { ServicePolicy, ServicePolicyDenial } from 'koa-rest-services'
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

  async getUser(): Promise<User> {
    // check its been initialised
    if (this.ctx.state.user.email) return this.ctx.state.user

    const user = await getUserFromToken(this.ctx)
    if (!user) this.ctx.throw(401)

    this.ctx.state.user = user
    return user
  }

  async getAPIKey(): Promise<APIKey> {
    if (this.ctx.state.key) return this.ctx.state.key

    const key = await (<EntityManager>this.ctx.em).getRepository(APIKey).findOne(this.ctx.state.user.sub, ['game'])
    if (key.revokedAt) this.ctx.throw(401)

    this.ctx.state.key = key
    return key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.getRepository(Game).findOne(gameId, ['organisation'])
    if (!game) this.ctx.throw(404, 'The specified game doesn\'t exist')
    this.ctx.state.game = game

    const user = await this.getUser()
    return game.organisation.id === user.organisation.id
  }

  async hasScope(scope: string): Promise<boolean | ServicePolicyDenial> {
    const key = await this.getAPIKey()
    const hasScope = key.scopes.includes(scope as APIKeyScope)

    return hasScope || new ServicePolicyDenial({ message: `Missing access key scope: ${scope}` }) 
  }

  async hasScopes(scopes: string[]): Promise<boolean | ServicePolicyDenial> {
    const key = await this.getAPIKey()
    const missing = scopes.filter((scope) => !key.scopes.includes(scope as APIKeyScope))

    return missing.length === 0 || new ServicePolicyDenial({ message: `Missing access key scope(s): ${missing.join(', ')}` }) 
  }
}
