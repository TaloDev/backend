import { apiRouter } from '../../../lib/routing/router'
import { RouterGroup } from '../../../lib/routing/router-group'
import { identifyRoute } from './identify'
import { searchRoute } from './search'
import { getRoute } from './get'
import { patchRoute } from './patch'
import { mergeRoute } from './merge'
import { socketTokenRoute } from './socket-token'

export function playerAPIRouter() {
  const opts = {
    docsKey: 'PlayerAPI'
  }

  return new RouterGroup([
    // static routes - mounted first so they are checked before /:id
    apiRouter('/v1/players', ({ route }) => {
      route(identifyRoute)
      route(searchRoute)
      route(mergeRoute)
      route(socketTokenRoute)
    }, opts),
    // parameterized routes
    apiRouter('/v1/players', ({ route }) => {
      route(getRoute)
      route(patchRoute)
    }, opts)
  ])
}
