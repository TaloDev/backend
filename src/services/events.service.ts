import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import EventsPolicy from '../lib/policies/events.policy'
import groupBy from 'lodash.groupby'
import { isSameDay, isValid, isAfter, sub } from 'date-fns'

interface EventData {
  name: string
  date: number
  count: number
  change: number
}

export default class EventsService implements Service {
  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: {
      gameId: 'Missing query key: gameId',
      startDate: (val: string, req: ServiceRequest) => {
        if (!val) return 'Missing query key: startDate'

        const startDate = new Date(val)
        if (!isValid(startDate)) return 'Invalid start date, please use YYYY-MM-DD'

        const endDate = new Date(req.ctx.query.endDate)
        if (isValid(endDate) && isAfter(startDate, endDate)) return 'Invalid start date, it should be before the end date'
      },
      endDate: (val: string, req: ServiceRequest) => {
        if (!val) return 'Missing query key: endDate'

        const endDate = new Date(val)
        if (!isValid(endDate)) return 'Invalid end date, please use YYYY-MM-DD'

        const startDate = new Date(req.ctx.query.endDate)
        if (isValid(startDate) && isAfter(endDate, startDate)) return 'Invalid end date, it should be after the start date'
      }
    }
  })
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      player: { game: Number(gameId) },
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }, ['player.game'])

    // events: {
    //   'Zone explored': [
    //     { name: 'Zone explored', date: 1577836800000, count: 3 },
    //     { name: 'Zone explored', date: 1577923200000, count: 1 }
    //   ],
    //   'Loot item': [
    //     { name: 'Loot item', date: '1577836800000, count: 0 }
    //     { name: 'Loot item', date: '1577923200000, count: 2 }
    //   ]
    // }

    const data = groupBy(events, 'name')
    for (let name in data) {
      let processed: EventData[] = []

      for (let date = new Date(startDate).getTime(); date < new Date(endDate).getTime(); date += 86400000 /* 24 hours in ms */) {
        const count = data[name].filter((event: Event) => isSameDay(new Date(date), new Date(event.createdAt))).length
        const change = processed.length > 0 ? this.calculateChange(name, date, count, processed[processed.length - 1]) : 1

        processed.push({
          name,
          date,
          count,
          change
        })
      }

      data[name] = processed
    }

    return {
      status: 200,
      body: {
        events: data,
        eventNames: Object.keys(data)
      }
    }
  }

  calculateChange(name: string, date: number, count: number, lastEvent: EventData): number {
    const useLastEvent = lastEvent.name === name && isSameDay(new Date(lastEvent.date), sub(new Date(date), { days: 1 }))

    if (useLastEvent) {
      if (lastEvent.count === 0) return 1 
      return (count - lastEvent.count) / lastEvent.count
    } else {
      return 1
    }
  }
}
