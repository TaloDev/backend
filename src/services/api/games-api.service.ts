import { Resource, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import GameResource from '../../resources/game.resource'
import GamesService from '../games.service'
import APIService from './api-service'

export default class GamesAPIService extends APIService {
  constructor(serviceName: string) {
    super(serviceName)
  }

  @Validate({
    body: ['name']
  })
  @Resource(GameResource, 'game')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<GamesService>(req).post(req)
  }
}
