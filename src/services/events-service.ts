import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import Player from '../entities/player'

export default class EventsService implements Service {
  @Validate({
    body: {
      name: 'Event needs a name',
      playerId: async (val: string, req: ServiceRequest) => {
        const em: EntityManager = req.ctx.em
        const player = await em.getRepository(Player).findOne(val)
        if (!player) return 'The specified player doesn\'t exist'
      }
    }
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, playerId, props } = req.body

    const event = new Event(name)
    event.props = props
    
    const em: EntityManager = req.ctx.em
    event.player = await em.getRepository(Player).findOne(playerId)
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
