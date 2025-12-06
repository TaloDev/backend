import Event from '../../../entities/event'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'

import { ClickHouseEvent, ClickHouseEventProp } from '../../../entities/event'

type SerialisedEvent = {
  id: string
  event: ClickHouseEvent
  props: ClickHouseEventProp[]
  playerId: string
}

export class FlushEventsQueueHandler extends FlushMetricsQueueHandler<Event, SerialisedEvent> {
  constructor() {
    super('events', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'events',
        values: values.map((item) => item.event),
        format: 'JSONEachRow'
      })
      await clickhouse.insert({
        table: 'event_props',
        values: values.flatMap((item) => item.props),
        format: 'JSONEachRow'
      })
    }, {
      postFlush: async (serializedValues) => {
        const playerIds = this.buildPlayerIdSet(serializedValues)

        if (playerIds.size > 0) {
          await postFlushCheckMemberships('FlushEventsQueueHandler', Array.from(playerIds))
        }
      }
    })
  }

  protected serialiseItem(event: Event) {
    return {
      id: event.id,
      event: event.toInsertable(),
      props: event.getInsertableProps(),
      playerId: event.playerAlias.player.id
    }
  }

  buildPlayerIdSet(values: SerialisedEvent[]): Set<string> {
    return new Set(values.map((item) => item.playerId))
  }
}
