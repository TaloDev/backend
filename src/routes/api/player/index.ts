import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { identifyRoute } from './identify.js'
import { mergeRoute } from './merge.js'
import { patchRoute } from './patch.js'
import { searchRoute } from './search.js'
import { socketTokenRoute } from './socket-token.js'

export function playerAPIRouter(router: Router, paramRouter: Router) {
  const docsKey = 'PlayerAPI'

  // static routes - mounted first so they are checked before /:id
  apiRouter(
    '/v1/players',
    ({ route }) => {
      route(identifyRoute)
      route(searchRoute)
      route(mergeRoute)
      route(socketTokenRoute)
    },
    { router, docsKey },
  )

  // parameterized routes
  apiRouter(
    '/v1/players',
    ({ route }) => {
      route(getRoute)
      route(patchRoute)
    },
    { router: paramRouter, docsKey },
  )
}
