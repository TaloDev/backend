import Event from '../../../entities/event'
import Player from '../../../entities/player'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'

export class FlushEventsQueueHandler extends FlushMetricsQueueHandler<Event> {
  constructor() {
    super('events', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'events',
        values: values.map((event) => event.toInsertable()),
        format: 'JSONEachRow'
      })
      await clickhouse.insert({
        table: 'event_props',
        values: values.flatMap((event) => event.getInsertableProps()),
        format: 'JSONEachRow'
      })
    }, {
      postFlush: async (values) => {
        const playerSet = this.buildPlayerSet(values)

        if (playerSet.size > 0) {
          /* v8 ignore next 3 */
          if (process.env.NODE_ENV !== 'test') {
            console.info(`FlushEventsQueueHandler checking groups for ${playerSet.size} players`)
          }
          await postFlushCheckMemberships(Array.from(playerSet))
        }
      }
    })
  }

  buildPlayerSet(values: Event[]) {
    const playerMap = new Map<string, Player>()
    for (const event of values) {
      playerMap.set(event.playerAlias.player.id, event.playerAlias.player)
    }
    return new Set(playerMap.values())
  }
}
