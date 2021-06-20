import { Context, Next } from 'koa'
import * as Sentry from '@sentry/node'

export default async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = {
      ...err
    }

    if (ctx.status === 500) {
      Sentry.withScope((scope) => {
        scope.addEventProcessor((event) => {
          return Sentry.Handlers.parseRequest(event, ctx.request);
        })
  
        if (ctx.state.user) {
          Sentry.setUser({ id: ctx.state.user.id })
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
