import { init as initHyperDX } from '@hyperdx/node-opentelemetry'
import { metrics, ValueType } from '@opentelemetry/api'

if (process.env.NODE_ENV !== 'test' && typeof process.env.HYPERDX_API_KEY === 'string') {
  initHyperDX({
    service: 'talo',
    instrumentations: {
      '@opentelemetry/instrumentation-http': {
        ignoreOutgoingRequestHook: (req) => req.hostname === process.env.CLICKHOUSE_HOST,
      },
    },
  })

  const nodeMonitorMeter = metrics.getMeter('node-monitor-meter')
  const gauge = nodeMonitorMeter.createObservableGauge('process.runtime.nodejs.memory.heap.total', {
    unit: 'bytes',
    valueType: ValueType.INT,
  })
  gauge.addCallback((result) => {
    result.observe(process.memoryUsage().heapTotal)
  })
}
