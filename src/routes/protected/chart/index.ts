import { protectedRouter } from '../../../lib/routing/router.js'
import { newLeaderboardEntriesRoute } from './new-leaderboard-entries.js'
import { newPlayersRoute } from './new-players.js'
import { statsActivityRoute } from './stats-activity.js'
import { statsGlobalValueRoute } from './stats-global-value.js'

export function chartRouter() {
  return protectedRouter('/games/:gameId/charts', ({ route }) => {
    route(newLeaderboardEntriesRoute)
    route(newPlayersRoute)
    route(statsActivityRoute)
    route(statsGlobalValueRoute)
  })
}
