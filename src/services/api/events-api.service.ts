import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Player from '../../entities/player'
import Event from '../../entities/event'
import EventsAPIPolicy from '../../lib/policies/api/events-api.policy'
import EventsService from '../events.service'
import APIService from './api-service'
import getAPIKeyFromToken from '../../lib/auth/getAPIKeyFromToken'
import EventResource from '../../resources/event.resource'

export default class EventsAPIService extends APIService {
  @Validate({
    body: ['name', 'playerId']
  })
  @HasPermission(EventsAPIPolicy, 'post')
  @Resource(EventResource, 'event')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, playerId, props } = req.body
    const em: EntityManager = req.ctx.em

    const player = await em.getRepository(Player).findOne(playerId)
    if (!player) req.ctx.throw(400, 'The specified player doesn\'t exist')

    const event = new Event(name, player)
    event.props = props    

    await em.persistAndFlush(event)

    return {
      status: 200,
      body: {
        event
      }
    }
  }

  @HasPermission(EventsAPIPolicy, 'get')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    req.query.gameId = ((await getAPIKeyFromToken(req.ctx)).game.id).toString()
    return await this.getService<EventsService>(req).get(req)
  }
}
