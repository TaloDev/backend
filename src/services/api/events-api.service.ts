import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Event from '../../entities/event'
import EventsAPIPolicy from '../../policies/api/events-api.policy'
import EventsService from '../events.service'
import APIService from './api-service'
import EventResource from '../../resources/event.resource'
import APIKey from '../../entities/api-key'
import PlayerAlias from '../../entities/player-alias'
import groupBy from 'lodash.groupby'

export default class EventsAPIService extends APIService<EventsService> {
  constructor() {
    super('events')
  }

  @Validate({
    body: {
      events: (val: string) => {
        if (!Array.isArray(val)) return 'Events must be an array'
      }
    }
  })
  @HasPermission(EventsAPIPolicy, 'post')
  @Resource(EventResource, 'events')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { events } = req.body
    const em: EntityManager = req.ctx.em

    const game = req.ctx.state.key.game // set in the policy

    const errors = [...new Array(events.length)].map(() => [])

    const uniqueAliases = Object.keys(groupBy(events, 'aliasId'))
      .filter((id) => !isNaN(Number(id)))
      .map((id) => Number(id))

    const aliases: PlayerAlias[] = await em.getRepository(PlayerAlias).find({
      id: uniqueAliases,
      player: { game }
    })

    const items: Event[] = []
    for (let i = 0; i < events.length; i++) {
      const item = events[i]
      const requiredKeys = ['name', 'aliasId', 'timestamp']

      requiredKeys.forEach((key) => {
        if (!item[key]) {
          errors[i] = [ ...errors[i], `Event is missing the key: ${key}` ]
        }
      })

      const alias = aliases.find((alias) => alias.id === item.aliasId)
      if (!alias) {
        errors[i] = [ ...errors[i], `No alias was found for aliasId ${item.aliasId}` ]
      } else if (errors[i].length === 0) {
        const event = new Event(item.name, game)
        event.props = item.props ?? {}
        event.playerAlias = alias
        event.createdAt = new Date(item.timestamp)
        items.push(event)
      }
    }

    await em.persistAndFlush(items)

    return {
      status: 200,
      body: {
        events: items,
        errors
      }
    }
  }

  @HasPermission(EventsAPIPolicy, 'get')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.query = {
      ...req.query,
      gameId: key.game.id.toString()
    }

    return await this.forwardRequest('get', req)
  }
}
