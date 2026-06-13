import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { postRoute } from './post.js'

export function eventAPIRouter(router: Router) {
  apiRouter(
    '/v1/events',
    ({ route }) => {
      route(postRoute)
    },
    {
      router,
      docsKey: 'EventAPI',
    },
  )
}
