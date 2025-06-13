import 'reflect-metadata'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { SERVICE_ROUTES, Routes, Service } from 'koa-clay'

export function TraceService() {
  return function <T extends { new (): Service }>(constructor: T) {
    const prototype = constructor.prototype
    const routes: Routes = Reflect.get(prototype, SERVICE_ROUTES) || []

    routes.forEach((routeConfig) => {
      const handlerName = routeConfig.handler
      const originalMethodDescriptor = Object.getOwnPropertyDescriptor(prototype, handlerName)

      if (originalMethodDescriptor && typeof originalMethodDescriptor.value === 'function') {
        const originalMethod = originalMethodDescriptor.value
        const spanName = `${constructor.name}@${handlerName}`

        originalMethodDescriptor.value = async function (...args: unknown[]) {
          return trace.getTracer('talo.http.service').startActiveSpan(spanName, async (span) => {
            try {
              const result = await originalMethod.apply(this, args)
              span.setStatus({ code: SpanStatusCode.OK })
              return result // Return the result of the original method.
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage })
              throw error
            } finally {
              span.end()
            }
          })
        }

        Object.defineProperty(prototype, handlerName, originalMethodDescriptor)
      }
    })

    return constructor
  }
}
