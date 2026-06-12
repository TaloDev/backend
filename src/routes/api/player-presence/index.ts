import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { putRoute } from './put.js'

export function playerPresenceAPIRouter(router: Router) {
  apiRouter(
    '/v1/players/presence',
    ({ route }) => {
      route(getRoute)
      route(putRoute)
    },
    {
      router,
      docsKey: 'PlayerPresenceAPI',
    },
  )
}
