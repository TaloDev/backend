import type Router from 'koa-tree-router'
import { publicRouter } from '../../../lib/routing/router.js'

export function healthCheckRouter(router: Router) {
  publicRouter(
    '/public/health',
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
