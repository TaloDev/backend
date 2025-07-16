import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'
import { getInsertableSocketEventData, SocketEventData } from '../../../socket/socketEvent'

export class FlushSocketEventsQueueHandler extends FlushMetricsQueueHandler<SocketEventData> {
  constructor() {
    super('socket-events', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'socket_events',
        values: values
          .filter((socketEvent) => !socketEvent.devBuild)
          .map((socketEvent) => getInsertableSocketEventData(socketEvent)),
        format: 'JSONEachRow'
      })
    }, {
      logsInTests: false
    })
  }
}
