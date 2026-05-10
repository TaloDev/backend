import { RouterGroup } from '../../../lib/routing/router-group.js'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { identifyRoute } from './identify.js'
import { mergeRoute } from './merge.js'
import { patchRoute } from './patch.js'
import { searchRoute } from './search.js'
import { socketTokenRoute } from './socket-token.js'

export function playerAPIRouter() {
  const opts = {
    docsKey: 'PlayerAPI',
  }

  return new RouterGroup([
    // static routes - mounted first so they are checked before /:id
    apiRouter(
      '/v1/players',
      ({ route }) => {
        route(identifyRoute)
        route(searchRoute)
        route(mergeRoute)
        route(socketTokenRoute)
      },
      opts,
    ),
    // parameterized routes
    apiRouter(
      '/v1/players',
      ({ route }) => {
        route(getRoute)
        route(patchRoute)
      },
      opts,
    ),
  ])
}
