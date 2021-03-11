import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import EventsPolicy from '../lib/policies/events.policy'
import groupBy from 'lodash.groupby'
import { isSameDay, sub } from 'date-fns'

export default class EventsService implements Service {
  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const startDate = sub(new Date(), { months: 1 }), endDate = new Date()
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      player: { game: Number(gameId) },
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }, ['player.game'])

    // events: {
    //   'Zone explored': [
    //     { date: 1577836800000, count: 3 },
    //     { date: 1577923200000, count: 1 }
    //   ],
    //   'Loot item': [
    //     { date: '1577836800000, count: 0 }
    //     { date: '1577923200000, count: 2 }
    //   ]
    // }

    const data = groupBy(events, 'name')
    for (let eventName in data) {
      let processed = []

      for (let i = startDate.getTime(); i < endDate.getTime(); i += 86400000 /* 24 hours in ms */) {
        processed.push({
          date: i,
          count: data[eventName].filter((event: Event) => isSameDay(new Date(i), new Date(event.createdAt))).length
        })
      }

      data[eventName] = processed
    }

    return {
      status: 200,
      body: {
        events: data
      }
    }
  }
}
