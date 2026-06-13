import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'

export function playerGroupAPIRouter(router: Router) {
  apiRouter(
    '/v1/player-groups',
    ({ route }) => {
      route(getRoute)
    },
    {
      router,
      docsKey: 'PlayerGroupAPI',
    },
  )
}
