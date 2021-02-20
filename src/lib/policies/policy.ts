import { EntityManager } from '@mikro-orm/core'
import { ServicePolicy } from 'koa-rest-services'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
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
    if (user.deletedAt) this.ctx.throw(401)
    return user
  }

  getSub(): number {
    return this.ctx.state.user.sub
  }

  async getAPIKey(): Promise<APIKey> {
    const key = await getAPIKeyFromToken(this.ctx)
    if (key.revokedAt) this.ctx.throw(401)
    return key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.getRepository(Game).findOne(gameId, ['teamMembers'])
    if (!game) this.ctx.throw(404, 'The specified game doesn\'t exist')
    this.ctx.state.game = game

    const team = game.teamMembers.toArray().map((user) => user.id)
    return team.includes(this.getSub())
  }

  hasScope(scope: string): boolean {
    return this.ctx.state.user.scopes.includes(scope)
  }
}
