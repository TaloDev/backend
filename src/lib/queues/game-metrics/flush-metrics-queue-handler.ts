import { Queue } from 'bullmq'
import createQueue from '../createQueue'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import createClickHouseClient from '../../clickhouse/createClient'
import { captureException } from '@sentry/node'
import { ClickHouseClient } from '@clickhouse/client'

type FlushFunc<T> = (clickhouse: ClickHouseClient, values: T[]) => Promise<void>
type HandlerOptions<T> = {
  logsInTests?: boolean
  postFlush?: (values: T[]) => Promise<void>
}

export class FlushMetricsQueueHandler<T extends { id: string }> {
  private queue: Queue
  private buffer: Map<string, T> = new Map()
  private options: HandlerOptions<T>

  constructor(private metricName: string, private flushFunc: FlushFunc<T>, options?: HandlerOptions<T>) {
    this.metricName = metricName
    this.flushFunc = flushFunc
    this.options = options ?? { logsInTests: true }

    this.queue = createQueue(`flush-${metricName}`, async () => {
      /* v8 ignore next */
      this.handle()
    })

    /* v8 ignore next 3 */
    const flushInterval = process.env.GAME_METRICS_FLUSH_INTERVAL
      ? Number(process.env.GAME_METRICS_FLUSH_INTERVAL)
      : 30_000

    this.queue.upsertJobScheduler(
      `flush-${metricName}-scheduler`,
      { every: flushInterval },
      { name: `flush-${metricName}-job` }
    )
  }

  async handle() {
    const bufferSize = this.buffer.size
    if (bufferSize === 0) {
      return
    }

    setTraceAttributes({ metricName: this.metricName, bufferSize })

    /* v8 ignore start */
    if (process.env.NODE_ENV !== 'test' || (this.options.logsInTests ?? true)) {
      console.info(`Flushing ${bufferSize} ${this.metricName.replace('-', ' ')}...`)
    }
    /* v8 ignore stop */
    const values = Array.from(this.buffer.values())

    const clickhouse = createClickHouseClient()
    try {
      await this.flushFunc(clickhouse, values)
      await clickhouse.close()
      await this.options.postFlush?.(values)
    } catch (err) {
      console.error(err)
      captureException(err)
    }

    values.forEach(({ id }) => this.buffer.delete(id))
  }

  add(item: T) {
    this.buffer.set(item.id, item)
  }
}
