import { trace, Tracer } from '@opentelemetry/api'

export function getSocketTracer(): Tracer {
  return trace.getTracer('talo.socket')
}
