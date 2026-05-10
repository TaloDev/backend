import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { putRoute } from './put.js'

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
