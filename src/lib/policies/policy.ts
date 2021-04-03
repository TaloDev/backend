import { EntityManager } from '@mikro-orm/core'
import { ServicePolicy } from 'koa-rest-services'
import { Context } from 'koa'
import APIKey, { APIKeyScope } from '../../entities/api-key'
import Game from '../../entities/game'
import User from '../../entities/user'
import getUserFromToken from '../auth/getUserFromToken'
import getAPIKeyFromToken from '../auth/getAPIKeyFromToken'

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
    const user = await getUserFromToken(this.ctx)
    return user
  }

  async getAPIKey(): Promise<APIKey> {
    const key = await getAPIKeyFromToken(this.ctx, ['game'])
    if (key.revokedAt) this.ctx.throw(401)
    return key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.getRepository(Game).findOne(gameId, ['organisation'])
    if (!game) this.ctx.throw(404, 'The specified game doesn\'t exist')
    this.ctx.state.game = game

    const user = await this.getUser()
    return game.organisation.id === user.organisation.id
  }

  async hasScope(scope: string): Promise<boolean> {
    const key = await this.getAPIKey()
    return key.scopes.includes(scope as APIKeyScope)
  }
}
