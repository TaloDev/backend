import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Request, Response, Validate, ValidationCondition, Docs } from 'koa-clay'
import EventAPIPolicy from '../../policies/api/event-api.policy'
import APIService from './api-service'
import EventAPIDocs from '../../docs/event-api.docs'
import Player from '../../entities/player'
import Event from '../../entities/event'
import Prop from '../../entities/prop'
import { ClickHouseClient } from '@clickhouse/client'

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
    const { events: items } = req.body
    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const events: Event[] = []
    const errors = Array.from({ length: items.length }).map(() => [])

    const player: Player = req.ctx.state.player
    const playerAlias = player.aliases.getItems().find((alias) => alias.id === req.ctx.state.currentAliasId)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      for (const key of ['name', 'timestamp']) {
        if (!item[key]) {
          errors[i].push(`Event is missing the key: ${key}`)
        }
      }

      if (errors[i].length === 0) {
        const event = new Event(item.name, player.game)
        event.playerAlias = playerAlias
        event.createdAt = new Date(item.timestamp)

        try {
          await clickhouse.insert({
            table: 'events',
            values: [event.getInsertableData()],
            format: 'JSONEachRow'
          })
        /* v8 ignore next 4 */
        } catch (err) {
          errors[i].push(`Failed to insert event: ${err.message}`)
          continue
        }

        if (Array.isArray(item.props)) {
          event.setProps(item.props.map((prop) => new Prop(prop.key, prop.value)))

          try {
            await clickhouse.insert({
              table: 'event_props',
              values: event.getInsertableProps(),
              format: 'JSONEachRow'
            })
          /* v8 ignore next 3 */
          } catch (err) {
            errors[i].push(`Failed to insert props': ${err.message}`)
          }
        } else if (item.props) {
          errors[i].push('Props must be an array')
        }

        if (errors[i].length === 0) {
          events.push(event)
        }
      }
    }

    // flush player meta props set by event.setProps()
    await em.flush()

    return {
      status: 200,
      body: {
        events,
        errors
      }
    }
  }
}
