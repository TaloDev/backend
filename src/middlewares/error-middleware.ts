import { Context, Next } from 'koa'
import * as Sentry from '@sentry/node'
import { Redis } from 'ioredis'

export default async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = ctx.status === 401 && Boolean(err.originalError) /* dont expose jwt error */
      ? { message: 'Please provide a valid token in the Authorization header' }
      : { ...err, headers: undefined /* koa cors is inserting headers into the body for some reason */ }

    if (ctx.state.redis instanceof Redis) {
      await (ctx.state.redis as Redis).quit()
    }

    if (ctx.status === 500) {
      Sentry.withScope((scope) => {
        scope.addEventProcessor((event) => {
          return Sentry.addRequestDataToEvent(event, ctx.request)
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
