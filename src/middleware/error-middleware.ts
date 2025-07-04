import { Context, Next } from 'koa'
import * as Sentry from '@sentry/node'
import { recordException as hdxRecordException } from '@hyperdx/node-opentelemetry'

export default async function errorMiddleware(ctx: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    if (err instanceof Error) {
      ctx.status = 'status' in err ? err.status as number : 500
      ctx.body = ctx.status === 401 && Boolean('originalError' in err && err.originalError) /* dont expose jwt error */
        ? { message: 'Please provide a valid token in the Authorization header' }
        : { ...err, headers: undefined /* koa cors is inserting headers into the body for some reason */ }

      if (ctx.status === 500) {
        hdxRecordException(err)

        Sentry.withScope((scope) => {
          scope.addEventProcessor((event) => {
            const headers = Object.entries(ctx.request.headers).reduce((acc, [key, value]) => {
              if (typeof value === 'string') {
                acc[key] = value
              }
              return acc
            }, {} as Record<string, string>)

            event.request = {
              method: ctx.request.method,
              url: ctx.request.url,
              headers: headers,
              data: (ctx.request as Sentry.PolymorphicRequest).body
            }
            return event
          })

          if (ctx.state.user) {
            const userId = ctx.state.user?.id ?? ctx.state.user?.sub
            Sentry.setUser({
              id: userId,
              apiKey: ctx.state.user?.api ?? false,
              username: ctx.state.user?.username
            })
          }

          Sentry.captureException(err)
        })

        if (process.env.NODE_ENV !== 'production') {
          console.error(err.stack)
        }
      }
    }
  }
}
