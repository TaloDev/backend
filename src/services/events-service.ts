import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import Player from '../entities/player'

export default class EventsService implements Service {
  @Validate({
    body: {
      name: 'Missing parameter: name',
      playerId: 'Missing parameter: playerId'
    }
  })
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
    const em: EntityManager = req.ctx.em
    const events = await em.getRepository(Event).findAll()

    return {
      status: 200,
      body: {
        events
      }
    }
  }
}
