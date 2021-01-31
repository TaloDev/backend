import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest } from 'koa-rest-services'
import Game from '../../entities/game'

export default class PlayersPolicy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    const userId: number = req.ctx.state.user.sub
    const em: EntityManager = req.ctx.em
  
    const game = await em.getRepository(Game).findOne(Number(gameId), ['teamMembers'])
    if (!game) return false
  
    if (!game.teamMembers.toArray().map((user) => user.id).includes(userId)) return false
  
    return true
  }
}
