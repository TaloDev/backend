import Policy from '../policy'
import { Context } from 'koa'
import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest } from 'koa-rest-services'
import Game from '../../../entities/game'
import APIKey from '../../../entities/api-key'

export default class PlayersAPIPolicy extends Policy {
  constructor(ctx: Context) {
    super(ctx)
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    const em: EntityManager = this.ctx.em

    const apiKey: APIKey = await this.getAPIKey()
    if (apiKey.game.id !== Number(gameId)) return false
  
    const game = await em.getRepository(Game).findOne(gameId)
    if (!game) return false

    return true
  }
}
