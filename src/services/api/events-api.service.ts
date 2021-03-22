import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../../entities/event'
import EventsAPIPolicy from '../../lib/policies/api/events-api.policy'
import EventsService from '../events.service'
import APIService from './api-service'
import EventResource from '../../resources/event.resource'
import APIKey from '../../entities/api-key'

export default class EventsAPIService extends APIService<EventsService> {
  constructor() {
    super('events')
  }

  @Validate({
    body: ['name', 'playerId']
  })
  @HasPermission(EventsAPIPolicy, 'post')
  @Resource(EventResource, 'event')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, props } = req.body
    const em: EntityManager = req.ctx.em

    const event = new Event(name, req.ctx.state.player) // set in the policy
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
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.query = {
      gameId: key.game.id.toString(),
      ...req.query
    }

    return await this.getService(req.ctx).get(req)
  }
}
