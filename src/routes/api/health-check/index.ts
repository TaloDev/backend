import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'

export function healthCheckAPIRouter(router: Router) {
  apiRouter(
    '/v1/health-check',
    ({ route }) => {
      route({
        method: 'get',
        handler: (ctx) => {
          if (ctx.query.body === '1') {
            return {
              status: 200,
              body: 'OK',
            }
          }

          return {
            status: 204,
          }
        },
      })
    },
    { router },
  )
}
