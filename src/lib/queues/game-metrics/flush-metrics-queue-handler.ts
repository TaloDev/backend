import { Queue } from 'bullmq'
import createQueue from '../createQueue'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import createClickHouseClient from '../../clickhouse/createClient'
import { captureException } from '@sentry/node'
import { getMetricFlushInterval } from '../../clickhouse/getMetricFlushInterval'
import { ClickHouseClient } from '@clickhouse/client'

type FlushFunc<T> = (clickhouse: ClickHouseClient, values: T[]) => Promise<void>

export class FlushMetricsQueueHandler<T extends { id: string }> {
  private queue: Queue
  private buffer: Map<string, T> = new Map()

  constructor(private metricName: string, private flushFunc: FlushFunc<T>) {
    this.metricName = metricName
    this.flushFunc = flushFunc

    this.queue = createQueue(`flush-${metricName}`, async () => {
      /* v8 ignore next */
      this.handle()
    })

    this.queue.upsertJobScheduler(
      `flush-${metricName}-scheduler`,
      { every: getMetricFlushInterval() },
      { name: `flush-${metricName}-job` }
    )
  }

  async handle() {
    const bufferSize = this.buffer.size
    if (bufferSize === 0) {
      return
    }

    setTraceAttributes({ metricName: this.metricName, bufferSize })

    console.info(`Flushing ${bufferSize} ${this.metricName.replace('-', ' ')}...`)
    const values = Array.from(this.buffer.values())

    const clickhouse = createClickHouseClient()
    try {
      await this.flushFunc(clickhouse, values)
      await clickhouse.close()
    } catch (err) {
      captureException(err)
    }

    values.forEach(({ id }) => this.buffer.delete(id))
  }

  add(item: T) {
    this.buffer.set(item.id, item)
  }
}
