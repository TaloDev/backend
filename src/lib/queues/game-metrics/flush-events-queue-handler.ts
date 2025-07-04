import Event from '../../../entities/event'
import { captureException } from '@sentry/node'
import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'

export class FlushEventsQueueHandler extends FlushMetricsQueueHandler<Event> {

  constructor() {
    super('events', async (clickhouse, values) => {
      try {
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
        await clickhouse.close()
      } catch (err) {
        captureException(err)
      }
    })
  }
}
