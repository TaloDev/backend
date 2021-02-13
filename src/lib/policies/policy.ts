import { EntityManager } from '@mikro-orm/core'
import { ServicePolicy } from 'koa-rest-services'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import Game from '../../entities/game'
import User from '../../entities/user'

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
    const user = await this.em.getRepository(User).findOne(this.ctx.state.user.sub)
    if (user.deletedAt) this.ctx.throw(401)
    return user
  }

  getSub(): number {
    return this.ctx.state.user.sub
  }

  async getAPIKey(): Promise<APIKey> {
    const key = await this.em.getRepository(APIKey).findOne(this.ctx.state.user.sub)
    if (key.revokedAt) this.ctx.throw(401)
    return key
  }

  async canAccessGame(gameId: number): Promise<boolean> {
    const game = await this.em.getRepository(Game).findOne(gameId, ['teamMembers'])
    if (!game) this.ctx.throw(404, 'The specified game doesn\'t exist')

    if (this.isAPICall()) {
      const key = await this.getAPIKey()
      return key.game.id === game.id
    } else {
      const team = game.teamMembers.toArray().map((user) => user.id)
      return team.includes(this.getSub())
    }
  }

  hasScope(scope: string): boolean {
    return this.ctx.state.user.scopes.includes(scope)
  }
}
