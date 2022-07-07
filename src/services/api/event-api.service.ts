import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Request, Response, Validate, ValidationCondition, Docs } from 'koa-clay'
import Event from '../../entities/event'
import EventAPIPolicy from '../../policies/api/event-api.policy'
import APIService from './api-service'
import PlayerAlias from '../../entities/player-alias'
import groupBy from 'lodash.groupby'
import EventAPIDocs from '../../docs/event-api.docs'

export default class EventAPIService extends APIService {
  @Validate({
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
          errors[i].push(`Event is missing the key: ${key}`)
        }
      })

      const alias = aliases.find((alias) => alias.id === item.aliasId)
      if (!alias) {
        errors[i].push(`No alias was found for aliasId ${item.aliasId}`)
      } else if (errors[i].length === 0) {
        const event = new Event(item.name, game)
        event.playerAlias = alias
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
