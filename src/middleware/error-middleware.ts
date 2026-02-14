import { Context, Next } from 'koa'
import * as Sentry from '@sentry/node'
import { recordException as hdxRecordException } from '@hyperdx/node-opentelemetry'

export async function errorMiddleware(ctx: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    if (err instanceof Error) {
      const isJWTError = 'originalError' in err && Boolean(err.originalError)

      ctx.status = 'status' in err ? err.status as number : 500
      ctx.body = ctx.status === 401 && isJWTError // dont expose jwt error
        ? { message: 'Please provide a valid token in the Authorization header' }
        : { ...err, headers: undefined } // koa cors is inserting headers into the body for some reason

      if (isJWTError) {
        const originalError = err.originalError
        if (canCaptureJWTError(originalError)) {
          hdxRecordException(originalError)
          Sentry.captureException(originalError)
        }
      }

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

          const userId = ctx.state.jwt?.sub
          if (userId) {
            Sentry.setUser({
              id: userId,
              apiKey: ctx.state.jwt?.api ?? false,
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

function canCaptureJWTError(err: unknown) {
  if (!(err instanceof Error)) return false
  if (err.name === 'TokenExpiredError') return false
  if (err.message === 'Token revoked') return false
  return true
}
