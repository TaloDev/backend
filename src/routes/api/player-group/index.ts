import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'

export function playerGroupAPIRouter() {
  return apiRouter(
    '/v1/player-groups',
    ({ route }) => {
      route(getRoute)
    },
    {
      docsKey: 'PlayerGroupAPI',
    },
  )
}
