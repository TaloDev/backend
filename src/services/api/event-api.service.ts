import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Request, Response, Validate, ValidationCondition, Route } from 'koa-clay'
import EventAPIPolicy from '../../policies/api/event-api.policy'
import APIService from './api-service'
import EventAPIDocs from '../../docs/event-api.docs'
import Player from '../../entities/player'
import Event from '../../entities/event'
import Prop from '../../entities/prop'
import { PropSizeError } from '../../lib/errors/propSizeError'
import { isValid } from 'date-fns'
import { TraceService } from '../../lib/tracing/trace-service'
import { createHash } from 'crypto'
import Redis from 'ioredis'
import { FlushEventsQueueHandler } from '../../lib/queues/game-metrics/flush-events-queue-handler'

@TraceService()
export default class EventAPIService extends APIService {
  private queueHandler: FlushEventsQueueHandler

  constructor() {
    super()
    this.queueHandler = new FlushEventsQueueHandler()
  }

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
    const redis: Redis = req.ctx.redis

    const eventsMap: Map<number, Event> = new Map()
    const errors: string[][] = Array.from({ length: items.length }, () => [])

    const player: Player = req.ctx.state.player
    const playerAlias = player.aliases.getItems().find((alias) => alias.id === req.ctx.state.currentAliasId)!

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      for (const key of ['name', 'timestamp']) {
        if (!item[key]) {
          errors[i].push(`Event is missing the key: ${key}${key === 'name' ? '' : ` (${item.name})`}`)
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
              errors[i].push(`${err.message} (${item.name})`)
            /* v8 ignore next 3 */
            } else {
              throw err
            }
          }
        } else if (item.props) {
          errors[i].push(`Props must be an array (${item.name})`)
        }

        if (!isValid(event.createdAt)) {
          errors[i].push(`Event timestamp is invalid (${item.name})`)
        }

        if (errors[i].length === 0) {
          // deduplication logic
          const hash = createHash('sha256')
            .update(JSON.stringify({
              playerAliasId: playerAlias.id,
              name: item.name,
              props: item.props ?? [],
              timestamp: Math.floor(new Date(item.timestamp).getTime() / 1000) // round up to nearest second
            }))
            .digest('hex')

          const isNew = await redis.set(`events:dedupe:${hash}`, '1', 'EX', 1, 'NX') // 1 second TTL
          if (!isNew) {
            errors[i].push(`Duplicate event detected (${item.name})`)
          } else {
            eventsMap.set(i, event)
          }
        }
      }
    }

    const eventsArray = Array.from(eventsMap.values())
    eventsArray.forEach((event) => {
      this.queueHandler.add(event)
    })

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
