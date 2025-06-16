import { init as initHyperDX } from '@hyperdx/node-opentelemetry'

export function enableTracing(isTest: boolean) {
  if (isTest || typeof process.env.HYPERDX_API_KEY !== 'string') {
    return
  }

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
