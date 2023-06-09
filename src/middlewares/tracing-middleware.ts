import * as Sentry from '@sentry/node'
import { Context, Next } from 'koa'
import { stripUrlQueryAndFragment } from '@sentry/utils'

export default async (ctx: Context, next: Next) => {
  const reqMethod = ctx.method.toUpperCase()
  const reqUrl = stripUrlQueryAndFragment(ctx.url)

  // connect to trace of upstream app
  let traceparentData
  /* c8 ignore next 3 */
  if (ctx.request.get('sentry-trace')) {
    traceparentData = Sentry.extractTraceparentData(ctx.request.get('sentry-trace'))
  }

  const transaction = Sentry.startTransaction({
    name: `${reqMethod} ${reqUrl}`,
    op: 'http.server',
    ...traceparentData
  })

  ctx.__sentry_transaction = transaction

  // we put the transaction on the scope so users can attach children to it
  Sentry.getCurrentHub().configureScope((scope) => {
    scope.setSpan(transaction)
  })

  ctx.res.on('finish', () => {
    // push `transaction.finish` to the next event loop so open spans have a chance to finish before the transaction closes
    setImmediate(() => {
      if (ctx.state.matchedRoute) {
        transaction.setName(`${reqMethod} ${ctx.state.matchedRoute}`)
      }
      transaction.setHttpStatus(ctx.status)
      transaction.finish()
    })
  })

  await next()
}
