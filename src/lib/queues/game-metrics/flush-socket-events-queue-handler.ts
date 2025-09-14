import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'
import { getInsertableSocketEventData, SocketEventData } from '../../../socket/socketEvent'
import { ClickHouseSocketEvent } from '../../../socket/socketEvent'

type SerialisedClickHouseSocketEvent = ClickHouseSocketEvent & { id: string }

export class FlushSocketEventsQueueHandler extends FlushMetricsQueueHandler<SocketEventData, SerialisedClickHouseSocketEvent> {
  constructor() {
    super('socket-events', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'socket_events',
        values: values.filter((socketEvent) => !socketEvent.dev_build),
        format: 'JSONEachRow'
      })
    }, {
      logsInTests: false
    })
  }

  protected serialiseItem(socketEvent: SocketEventData) {
    return {
      id: socketEvent.id,
      ...getInsertableSocketEventData(socketEvent)
    }
  }
}
