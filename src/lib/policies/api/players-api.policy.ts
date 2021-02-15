import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'

export default class PlayersAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const key = await this.getAPIKey()
    return this.hasScope('read:players') && this.canAccessGame(key.game.id)
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const key = await this.getAPIKey()
    return this.hasScope('write:players') && this.canAccessGame(key.game.id)
  }

  async identify(req: ServiceRequest): Promise<boolean> {
    return this.hasScope('read:players')
  }
}
