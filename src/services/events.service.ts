import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import EventsPolicy from '../lib/policies/events.policy'
import EventResource from '../resources/event.resource'

export default class EventsService implements Service {
  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  @Resource(EventResource, 'events')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const events = await em.getRepository(Event).find({ player: { game: Number(gameId) }}, ['player.game'])

    return {
      status: 200,
      body: {
        events
      }
    }
  }
}
