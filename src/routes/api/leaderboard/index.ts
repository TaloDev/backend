import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { postRoute } from './post.js'

export function leaderboardAPIRouter() {
  return apiRouter(
    '/v1/leaderboards',
    ({ route }) => {
      route(getRoute)
      route(postRoute)
    },
    {
      docsKey: 'LeaderboardAPI',
    },
  )
}
