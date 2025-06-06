import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Request, Response, Validate, ValidationCondition, Route } from 'koa-clay'
import EventAPIPolicy from '../../policies/api/event-api.policy'
import APIService from './api-service'
import EventAPIDocs from '../../docs/event-api.docs'
import Player from '../../entities/player'
import Event from '../../entities/event'
import Prop from '../../entities/prop'
import { ClickHouseClient } from '@clickhouse/client'
import { PropSizeError } from '../../lib/errors/propSizeError'
import { isValid } from 'date-fns'

export default class EventAPIService extends APIService {
  @Route({
    method: 'POST',
    docs: EventAPIDocs.post
  })
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
  async post(req: Request): Promise<Response> {
    const { events: items } = req.body
    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const eventsMap: Map<number, Event> = new Map()
    const errors: string[][] = Array.from({ length: items.length }, () => [])

    const player: Player = req.ctx.state.player
    const playerAlias = player.aliases.getItems().find((alias) => alias.id === req.ctx.state.currentAliasId)!

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      for (const key of ['name', 'timestamp']) {
        if (!item[key]) {
          errors[i].push(`Event is missing the key: ${key}`)
        }
      }

      if (errors[i].length === 0) {
        const event = new Event()
        event.construct(item.name, player.game)
        event.playerAlias = playerAlias
        event.createdAt = new Date(item.timestamp)

        if (Array.isArray(item.props)) {
          try {
            event.setProps(item.props.map((prop: Prop) => new Prop(prop.key, prop.value)))
          } catch (err) {
            if (err instanceof PropSizeError) {
              errors[i].push(err.message)
            /* v8 ignore next 3 */
            } else {
              throw err
            }
          }
        } else if (item.props) {
          errors[i].push('Props must be an array')
        }

        if (!isValid(event.createdAt)) {
          errors[i].push('Event timestamp is invalid')
        }

        if (errors[i].length === 0) {
          eventsMap.set(i, event)
        }
      }
    }

    const eventsArray = Array.from(eventsMap.values())

    try {
      await clickhouse.insert({
        table: 'events',
        values: eventsArray.map((event) => event.toInsertable()),
        format: 'JSONEachRow'
      })
    } catch (err) {
      for (const idx of eventsMap.keys()) {
        errors[idx].push(`Failed to insert events': ${(err as Error).message}`)
      }
    }

    try {
      await clickhouse.insert({
        table: 'event_props',
        values: eventsArray.flatMap((event) => event.getInsertableProps()),
        format: 'JSONEachRow'
      })
    } catch (err) {
      for (const idx of eventsMap.keys()) {
        errors[idx].push(`Failed to insert props': ${(err as Error).message}`)
      }
    }

    // flush player meta props set by event.setProps()
    await em.flush()

    return {
      status: 200,
      body: {
        events: eventsArray,
        errors
      }
    }
  }
}
