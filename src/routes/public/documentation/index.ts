import type Router from 'koa-tree-router'
import { publicRouter } from '../../../lib/routing/router.js'

export function documentationRouter(router: Router) {
  publicRouter(
    '/public/docs',
    ({ route }) => {
      route({
        method: 'get',
        handler: () => {
          return {
            status: 200,
            body: {
              docs: {
                services: globalThis.talo.docs.getServices(),
              },
            },
          }
        },
      })
    },
    { router },
  )
}
