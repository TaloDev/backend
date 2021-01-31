import Policy from './policy'
import { Context } from 'koa'
import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest } from 'koa-rest-services'
import Game from '../../entities/game'
export default class PlayersPolicy extends Policy {
  constructor(ctx: Context) {
    super(ctx)
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    const em: EntityManager = this.ctx.em
  
    const game = await em.getRepository(Game).findOne(gameId, ['teamMembers'])
    if (!game) return false
  
    if (!this.isAPICall()) {
      const team = game.teamMembers.toArray().map((user) => user.id)
      if (!team.includes(this.getSub())) return false
    }
  
    return true
  }
}
