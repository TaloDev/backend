import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'

export default class PlayersAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    return await this.hasScope('read:players')
  }

  async post(req: ServiceRequest): Promise<boolean> {
    return await this.hasScope('write:players')
  }

  async identify(req: ServiceRequest): Promise<boolean> {
    return await this.hasScope('read:players')
  }

  async patch(req: ServiceRequest): Promise<boolean> {
    return await this.hasScope('write:players')
  }
}
