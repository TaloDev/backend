import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { postRoute } from './post.js'

export function leaderboardAPIRouter(router: Router) {
  apiRouter(
    '/v1/leaderboards',
    ({ route }) => {
      route(getRoute)
      route(postRoute)
    },
    {
      router,
      docsKey: 'LeaderboardAPI',
    },
  )
}
