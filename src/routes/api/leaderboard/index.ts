import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { postRoute } from './post.js'
import { topRoute } from './top.js'

export function leaderboardAPIRouter(router: Router) {
  apiRouter(
    '/v1/leaderboards',
    ({ route }) => {
      route(getRoute)
      route(topRoute)
      route(postRoute)
    },
    {
      router,
      docsKey: 'LeaderboardAPI',
    },
  )
}
