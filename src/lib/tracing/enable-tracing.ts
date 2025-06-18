import { init as initHyperDX } from '@hyperdx/node-opentelemetry'

if (process.env.NODE_ENV !== 'test' && typeof process.env.HYPERDX_API_KEY === 'string') {
  initHyperDX({
    service: 'talo',
    instrumentations: {
      '@opentelemetry/instrumentation-http': {
        // todo: advanced network capture doesn't work because this overrides the config
        ignoreOutgoingRequestHook: (req) => req.hostname === process.env.CLICKHOUSE_HOST
      }
    }
  })
}
