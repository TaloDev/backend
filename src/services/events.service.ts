import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../entities/event'
import EventsPolicy from '../lib/policies/events.policy'
import EventResource from '../resources/event.resource'
import groupBy from 'lodash.groupby'

// const data = groupBy(eventResources, 'name')
// for (let eventName in data) {
//   data[eventName] = data[eventName].reduce((acc, curr: Event) => {
//     const date = curr.createdAt.toISOString().split('T')[0]
//     return {
//       ...acc,
//       [date]: (acc[date] ?? 0) + 1
//     }
//   }, {})
// }
// events: {
//   'Zone Explored': {
//     '2020-01-01': 3,
//     '2020-01-02': 1,
//     '2020-01-03': 6
//   }
// }

// const data = groupBy(eventResources, (event) => event.createdAt.toISOString().split('T')[0])

// for (let day in data) {
//   data[day] = data[day].reduce((acc, curr: Event) => {
//     return {
//       ...acc,
//       [curr.name]: (acc[curr.name] ?? 0) + 1 
//     }
//   }, {})
// }
// events: {
//   '2020-01-01': {
//     'Death': 5,
//     'Loot Item': 3
//   },
//   '2020-01-02': {
//     'Loot Item': 5
//   }
// }

export default class EventsService implements Service {
  @HasPermission(EventsPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  // @Resource(EventResource, 'events')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({ player: { game: Number(gameId) }}, ['player.game'])
    const eventResources: EventResource[] = await Promise.all(events.map(async (e) => await new EventResource(e).transform()))
    const data = groupBy(eventResources, 'name')

    // events: {
    //   'Zone explored': [
    //     { date: '2021-01-01', count: 3 },
    //     { date: '2021-01-02', count: 1 }
    //   ],
    //   'Loot item': [
    //     { date: '2021-01-04', count: 2 }
    //   ]
    // }

    for (let eventName in data) {
      data[eventName] = data[eventName].reduce((acc, event: Event) => {
        const date = event.createdAt.toISOString().split('T')[0]

        if (acc.find((datum) => datum.date === date)) {
          return acc.map((datum) => {
            if (datum.date === date) return { ...datum, count: datum.count + 1 }
            return datum
          })
        } else {
          return [
            ...acc,
            { date, count: 1 }
          ]
        }
      }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    return {
      status: 200,
      body: {
        events: data
      }
    }
  }
}
