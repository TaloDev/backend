import { apiRouter } from '../../../lib/routing/router'
import { getRoute } from './get'
import { postRoute } from './post'

export function leaderboardAPIRouter() {
  return apiRouter('/v1/leaderboards', ({ route }) => {
    route(getRoute)
    route(postRoute)
  }, {
    docsKey: 'LeaderboardAPI'
  })
}
