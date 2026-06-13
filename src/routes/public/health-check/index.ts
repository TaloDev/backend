import type Router from 'koa-tree-router'
import { publicRouter } from '../../../lib/routing/router.js'

export function healthCheckRouter(router: Router) {
  publicRouter(
    '/public/health',
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
