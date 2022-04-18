import { EntityManager, FilterQuery } from '@mikro-orm/core'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import Event from '../entities/event'
import EventPolicy from '../policies/event.policy'
import groupBy from 'lodash.groupby'
import { isSameDay, endOfDay } from 'date-fns'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'

interface EventData {
  name: string
  date: number
  count: number
  change: number
}

export default class EventService implements Service {
  @Validate({
    query: {
      gameId: {
        required: true
      },
      ...dateValidationSchema
    }
  })
  @HasPermission(EventPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const where: FilterQuery<Event> = {
      game: Number(gameId),
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter
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

      for (let date = new Date(startDate).getTime(); date <= new Date(endDate).getTime(); date += 86400000 /* 24 hours in ms */) {
        const count = data[name].filter((event: Event) => isSameDay(new Date(date), new Date(event.createdAt))).length
        const change = processed.length > 0 ? this.calculateChange(count, processed[processed.length - 1]) : 0

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

  calculateChange(count: number, lastEvent: EventData): number {
    if (lastEvent.count === 0) return 1
    return (count - lastEvent.count) / lastEvent.count
  }
}
