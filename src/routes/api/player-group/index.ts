import { apiRouter } from '../../../lib/routing/router'
import { getRoute } from './get'

export function playerGroupAPIRouter() {
  return apiRouter('/v1/player-groups', ({ route }) => {
    route(getRoute)
  }, {
    docsKey: 'PlayerGroupAPI'
  })
}
