import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Request, Response, Validate, ValidationCondition, Docs } from 'koa-clay'
import Event from '../../entities/event'
import EventAPIPolicy from '../../policies/api/event-api.policy'
import APIService from './api-service'
import EventAPIDocs from '../../docs/event-api.docs'
import Player from '../../entities/player'

export default class EventAPIService extends APIService {
  @Validate({
    headers: ['x-talo-alias'],
    body: {
      events: {
        required: true,
        validation: async (val: unknown): Promise<ValidationCondition[]> => [
          {
            check: Array.isArray(val),
            error: 'Events must be an array'
          }
        ]
      }
    }
  })
  @HasPermission(EventAPIPolicy, 'post')
  @Docs(EventAPIDocs.post)
  async post(req: Request): Promise<Response> {
    const { events } = req.body
    const em: EntityManager = req.ctx.em

    const errors = [...new Array(events.length)].map(() => [])
    const items: Event[] = []

    for (let i = 0; i < events.length; i++) {
      const item = events[i]

      for (const key of ['name', 'timestamp']) {
        if (!item[key]) errors[i].push(`Event is missing the key: ${key}`)
      }

      if (errors[i].length === 0) {
        const event = new Event(item.name, req.ctx.state.key.game)
        event.playerAlias = (req.ctx.state.player as Player).aliases.getItems().find((alias) => alias.id === req.ctx.state.currentAliasId)
        event.createdAt = new Date(item.timestamp)

        if (item.props) {
          try {
            if (!Array.isArray(item.props)) throw new Error('Props must be an array')
            event.setProps(item.props)
          } catch (err) {
            errors[i].push(err.message)
          }
        }

        if (errors[i].length === 0) items.push(event)
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
}
