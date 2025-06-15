import { init as initHyperDX } from '@hyperdx/node-opentelemetry'

export function enableTracing() {
  initHyperDX({
    service: 'talo',
    instrumentations: {
      '@opentelemetry/instrumentation-http': {
        ignoreOutgoingRequestHook: (req) => req.hostname === process.env.CLICKHOUSE_HOST
      }
    }
  })
}
