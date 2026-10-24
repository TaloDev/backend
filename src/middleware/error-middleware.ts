import { recordException as hdxRecordException } from '@hyperdx/node-opentelemetry'
import { trace } from '@opentelemetry/api'
import * as Sentry from '@sentry/node'
import jwt from 'jsonwebtoken'
import { Context, Next } from 'koa'

export async function errorMiddleware(ctx: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    if (err instanceof Error) {
      const isJWTError = 'originalError' in err && Boolean(err.originalError)
      const traceId = trace.getActiveSpan()?.spanContext().traceId

      ctx.status = 'status' in err ? (err.status as number) : 500
      ctx.body =
        ctx.status === 401 && isJWTError
          ? { message: 'Please provide a valid token in the Authorization header', traceId }
          : process.env.NODE_ENV === 'production' && ctx.status >= 500
            ? {
                message: 'Something went wrong, please try again later',
                traceId,
              }
            : { ...err, message: err.message, headers: undefined, traceId }

      if (isJWTError) {
        const originalError = err.originalError
        if (canCaptureJWTError(originalError)) {
          await hdxRecordException(originalError)
          Sentry.withScope((scope) => {
            scope.addEventProcessor((event) => {
              event.request = {
                method: ctx.request.method,
                url: ctx.request.url,
              }
              return event
            })
            Sentry.captureException(originalError)
          })
        }
      }

      if (ctx.status === 500) {
        await hdxRecordException(err)

        Sentry.withScope((scope) => {
          scope.addEventProcessor((event) => {
            const headers = Object.entries(ctx.request.headers).reduce(
              (acc, [key, value]) => {
                if (typeof value === 'string') {
                  acc[key] = value
                }
                return acc
              },
              {} as Record<string, string>,
            )

            event.request = {
              method: ctx.request.method,
              url: ctx.request.url,
              headers: headers,
              data: (ctx.request as Sentry.PolymorphicRequest).body,
            }
            return event
          })

          const userId = ctx.state.jwt?.sub
          if (userId) {
            scope.setUser({
              id: userId,
              apiKey: ctx.state.jwt?.api ?? false,
              username: ctx.state.user?.username,
            })
          }

          if (ctx.state.game) {
            scope.setContext('game', { id: ctx.state.game.id })
          }

          if (traceId) {
            scope.setTag('traceId', traceId)
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

// expected auth failures that arrive as plain Errors from koa-jwt: the token's
// API key can't be resolved, or the key was revoked
const IGNORED_JWT_MESSAGES = new Set(['Token revoked', 'Secret not provided'])

export function canCaptureJWTError(err: unknown) {
  if (!(err instanceof Error)) return false
  // any jsonwebtoken verification failure is a bad client token
  if (err instanceof jwt.JsonWebTokenError) {
    return false
  }
  return !IGNORED_JWT_MESSAGES.has(err.message)
}
