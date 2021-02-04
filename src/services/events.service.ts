import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import EventsPolicy from '../lib/policies/events.policy'

export default class EventsService implements Service {
  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const events = await em.getRepository(Event).find({ player: { game: Number(gameId) }})

    return {
      status: 200,
      body: {
        events
      }
    }
  }
}
