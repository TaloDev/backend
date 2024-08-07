import { FilterQuery, EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import Event from '../entities/event'
import EventPolicy from '../policies/event.policy'
import groupBy from 'lodash.groupby'
import { isSameDay, endOfDay } from 'date-fns'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'

type EventData = {
  name: string
  date: number
  count: number
  change: number
}

export default class EventService extends Service {
  @Validate({
    query: dateValidationSchema
  })
  @HasPermission(EventPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query
    const em: EntityManager = req.ctx.em

    const startDate = new Date(startDateQuery)
    const endDate = new Date(endDateQuery)

    const where: FilterQuery<Event> = {
      game: req.ctx.state.game,
      createdAt: {
        $gte: startDate,
        $lte: endOfDay(endDate)
      }
    }

    if (!req.ctx.state.includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter(em)
      }
    }

    const events = await em.getRepository(Event).find(where)

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

    for (const name in data) {
      const processed: EventData[] = []

      for (let time = startDate.getTime(); time <= endDate.getTime(); time += 86400000 /* 24 hours in ms */) {
        const dateFromTime = new Date(time)

        const count = data[name].filter((event: Event) => isSameDay(dateFromTime, event.createdAt)).length
        const change = processed.length > 0 ? this.calculateChange(count, processed[processed.length - 1]) : 0

        processed.push({
          name,
          date: time,
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

  calculateChange(count: number, lastEvent: EventData): number {
    if (lastEvent.count === 0) return 1
    return (count - lastEvent.count) / lastEvent.count
  }
}
