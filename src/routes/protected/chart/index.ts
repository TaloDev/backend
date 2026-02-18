import { protectedRouter } from '../../../lib/routing/router'
import { newLeaderboardEntriesRoute } from './new-leaderboard-entries'
import { newPlayersRoute } from './new-players'
import { statsActivityRoute } from './stats-activity'

export function chartRouter() {
  return protectedRouter('/games/:gameId/charts', ({ route }) => {
    route(newLeaderboardEntriesRoute)
    route(newPlayersRoute)
    route(statsActivityRoute)
  })
}
