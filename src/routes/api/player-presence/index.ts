import { apiRouter } from '../../../lib/routing/router'
import { getRoute } from './get'
import { putRoute } from './put'

export function playerPresenceAPIRouter() {
  return apiRouter(
    '/v1/players/presence',
    ({ route }) => {
      route(getRoute)
      route(putRoute)
    },
    {
      docsKey: 'PlayerPresenceAPI',
    },
  )
}
