import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import Player from '../entities/player'
import EventsPolicy from '../lib/policies/events.policy'
import HasPermission from '../lib/policies/hasPermission'

export default class EventsService implements Service {
  @Validate({
    body: ['name', 'player']
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, player, props } = req.body
    const em: EntityManager = req.ctx.em

    const event = new Event(name)
    event.props = props    
    event.player = await em.getRepository(Player).findOne(player)

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

  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const events = await em.getRepository(Event).find({ player: { game: gameId }})

    return {
      status: 200,
      body: {
        events
      }
    }
  }
}
