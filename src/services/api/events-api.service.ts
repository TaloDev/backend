import { EntityManager } from '@mikro-orm/core'
import { HasPermission, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Player from '../../entities/player'
import Event from '../../entities/event'
import EventsAPIPolicy from '../../lib/policies/api/events-api.policy'
import EventsService from '../events.service'
import APIService from './api-service'

export default class EventsAPIService extends APIService {
  @Validate({
    body: ['name', 'playerId']
  })
  @HasPermission(EventsAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, playerId, props } = req.body
    const em: EntityManager = req.ctx.em

    const event = new Event(name)
    event.props = props    
    event.player = await em.getRepository(Player).findOne(playerId)

    if (!event.player) {
      req.ctx.throw(400, 'The specified player doesn\'t exist')
    }

    await em.persistAndFlush(event)

    return {
      status: 200,
      body: {
        event
      }
    }
  }

  async get(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<EventsService>(req).get(req)
  }
}
