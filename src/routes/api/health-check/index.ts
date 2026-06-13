import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'

export function healthCheckAPIRouter(router: Router) {
  apiRouter(
    '/v1/health-check',
    ({ route }) => {
      route({
        method: 'get',
        handler: () => {
          return {
            status: 204,
          }
        },
      })
    },
    { router },
  )
}
