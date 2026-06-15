import { init as initHyperDX } from '@hyperdx/node-opentelemetry'
import { Connection } from '@mikro-orm/mysql'
import { metrics, SpanStatusCode, trace, ValueType } from '@opentelemetry/api'

if (process.env.NODE_ENV !== 'test' && typeof process.env.HYPERDX_API_KEY === 'string') {
  initHyperDX({
    service: 'talo',
    instrumentations: {
      '@opentelemetry/instrumentation-http': {
        ignoreOutgoingRequestHook: (req) => req.hostname === process.env.CLICKHOUSE_HOST,
      },
    },
  })

  // monitor memory usage
  const nodeMonitorMeter = metrics.getMeter('node-monitor-meter')
  const gauge = nodeMonitorMeter.createObservableGauge('process.runtime.nodejs.memory.heap.total', {
    unit: 'bytes',
    valueType: ValueType.INT,
  })
  gauge.addCallback((result) => {
    result.observe(process.memoryUsage().heapTotal)
  })

  // mysql otel tracing doesn't work for esm, configure a custom hook
  const executeQueryDescriptor = Object.getOwnPropertyDescriptor(
    Connection.prototype,
    'executeQuery',
  )

  if (executeQueryDescriptor) {
    Object.defineProperty(Connection.prototype, 'executeQuery', {
      value: async function <T>(
        query: string,
        cb: () => Promise<T>,
        context?: Record<string, unknown>,
      ) {
        const span = trace.getTracer('mysql').startSpan('mysql.query', {
          attributes: {
            'db.system': 'mysql',
            'db.statement': query,
            'db.operation': query.trim().split(/\s+/)[0].toUpperCase(),
          },
        })

        try {
          return await executeQueryDescriptor.value.call(this, query, cb, context)
        } catch (error) {
          span.recordException(error as Error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          })
          throw error
        } finally {
          span.end()
        }
      },
      writable: true,
      configurable: true,
    })
  }
}
