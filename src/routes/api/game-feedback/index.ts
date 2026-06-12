import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { listCategoriesRoute } from './list-categories.js'
import { postRoute } from './post.js'

export function gameFeedbackAPIRouter(router: Router) {
  apiRouter(
    '/v1/game-feedback',
    ({ route }) => {
      route(listCategoriesRoute)
      route(postRoute)
    },
    {
      router,
      docsKey: 'GameFeedbackAPI',
    },
  )
}
