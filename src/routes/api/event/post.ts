import { createHash } from 'crypto'
import { isValid } from 'date-fns'
import type { PropRejectionReason } from '../../../lib/props/sanitiseProps.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import Event from '../../../entities/event.js'
import Prop from '../../../entities/prop.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import { FlushEventsQueueHandler } from '../../../lib/queues/game-metrics/flush-events-queue-handler.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { postDocs } from './docs.js'

type EventErrorCode =
  | 'MISSING_NAME'
  | 'MISSING_TIMESTAMP'
  | 'INVALID_TIMESTAMP'
  | 'PROPS_NOT_ARRAY'
  | 'DUPLICATE_EVENT'
  | 'DUPLICATE_DETECTION_FAILED'
  | 'REDIS_PIPELINE_FAILED'
  | PropRejectionReason

type EventError = {
  field: string
  error: EventErrorCode
  message: string
}

let queueHandler: FlushEventsQueueHandler

function getQueueHandler() {
  if (!queueHandler) {
    queueHandler = new FlushEventsQueueHandler()
  }
  return queueHandler
}

export const postRoute = apiRoute({
  method: 'post',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    body: z.object({
      events: z.array(z.unknown()).meta({ description: 'An array of @type(EventData:eventdata)' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_EVENTS]), loadAlias),
  handler: async (ctx) => {
    const { events: items } = ctx.state.validated.body
    const em = ctx.em
    const redis = ctx.redis

    const eventsMap: Map<number, Event> = new Map()
    const errors: EventError[][] = Array.from({ length: items.length }, () => [])

    const playerAlias = ctx.state.alias

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>

      for (const key of ['name', 'timestamp']) {
        if (!item[key]) {
          errors[i].push({
            field: key,
            error: key === 'name' ? 'MISSING_NAME' : 'MISSING_TIMESTAMP',
            message: `Event is missing the key: ${key}${key === 'name' ? '' : ` (${item.name})`}`,
          })
        }
      }

      if (errors[i].length === 0) {
        const event = new Event()
        event.construct(item.name as string, playerAlias.player.game)
        event.playerAlias = playerAlias
        event.createdAt = new Date(item.timestamp as number)

        if (Array.isArray(item.props)) {
          try {
            event.setProps(item.props.map((prop: Prop) => new Prop(prop.key, prop.value)))
          } catch (err) {
            if (err instanceof PropRejectionError) {
              for (const rejectedItem of err.rejected) {
                errors[i].push({
                  field: `props.${rejectedItem.key}`,
                  error: rejectedItem.error,
                  message: `${rejectedItem.message} (${item.name})`,
                })
              }
              /* v8 ignore next 3 -- @preserve */
            } else {
              throw err
            }
          }
        } else if (item.props) {
          errors[i].push({
            field: 'props',
            error: 'PROPS_NOT_ARRAY',
            message: `Props must be an array (${item.name})`,
          })
        }

        if (!isValid(event.createdAt)) {
          errors[i].push({
            field: 'timestamp',
            error: 'INVALID_TIMESTAMP',
            message: `Event timestamp is invalid (${item.name})`,
          })
        }

        if (errors[i].length === 0) {
          eventsMap.set(i, event)
        }
      }
    }

    const pipeline = redis.pipeline()
    const hashes: string[] = []

    for (const event of eventsMap.values()) {
      const hash = createHash('sha256')
        .update(
          JSON.stringify({
            playerAliasId: playerAlias.id,
            name: event.name,
            props: event.props,
            timestamp: Math.floor(event.createdAt.getTime() / 1000),
          }),
        )
        .digest('hex')

      hashes.push(hash)
      pipeline.setnx(`events:dedupe:${hash}`, '1')
      pipeline.expire(`events:dedupe:${hash}`, 1)
    }

    const results = await pipeline.exec()

    /* v8 ignore start -- @preserve */
    if (!results) {
      for (let i = 0; i < items.length; i++) {
        if (eventsMap.has(i)) {
          errors[i].push({
            field: 'event',
            error: 'REDIS_PIPELINE_FAILED',
            message: 'Redis pipeline failed',
          })
        }
      }
      /* v8 ignore stop -- @preserve */
    } else {
      let resultIndex = 0
      for (const index of Array.from(eventsMap.keys())) {
        const item = items[index] as Record<string, unknown>
        // each event has 2 operations (setnx + expire), so we check the setnx result
        const [err, result] = results[resultIndex * 2]

        /* v8 ignore start -- @preserve */
        if (err) {
          eventsMap.delete(index)
          errors[index].push({
            field: 'event',
            error: 'DUPLICATE_DETECTION_FAILED',
            message: `Duplicate detection failed (${item.name}): ${err.message}`,
          })
          /* v8 ignore stop -- @preserve */
        } else if (result !== 1) {
          eventsMap.delete(index)
          errors[index].push({
            field: 'event',
            error: 'DUPLICATE_EVENT',
            message: `Duplicate event detected (${item.name})`,
          })
        }
        resultIndex++
      }
    }
    const eventsArray = Array.from(eventsMap.values())
    await Promise.all(eventsArray.map((event) => getQueueHandler().add(event)))

    // flush player meta props set by event.setProps()
    await em.flush()

    return {
      status: 200,
      body: {
        events: eventsArray,
        errors,
      },
    }
  },
})
