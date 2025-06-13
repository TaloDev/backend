import { Context, Next } from 'koa'
import * as Sentry from '@sentry/node'
import Redis from 'ioredis'
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

      if (ctx.state.redis instanceof Redis) {
        await (ctx.state.redis as Redis).quit()
      }

      if (ctx.status === 500) {
        hdxRecordException(err)

        Sentry.withScope((scope) => {
          scope.addEventProcessor((event) => {
            return Sentry.addRequestDataToEvent(event, ctx.request as Sentry.PolymorphicRequest)
          })

          if (ctx.state.user) {
            Sentry.setUser({ id: ctx.state.user.id, username: ctx.state.user.username })
            Sentry.setTag('apiKey', ctx.state.user.api ?? false)
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
