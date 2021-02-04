import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'
import APIKey from '../../entities/api-key'

export default class APIKeysPolicy extends Policy {
  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body
    return this.canAccessGame(gameId)
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return this.canAccessGame(Number(gameId))
  }

  async delete(req: ServiceRequest): Promise<boolean> {
    const { id } = req.params
    const apiKey = await this.em.getRepository(APIKey).findOne(id)
    return this.canAccessGame(apiKey.game.id)
  }
}
