import { protectedRouter } from '../../../lib/routing/router'
import { newPlayersRoute } from './new-players'
import { statsActivityRoute } from './stats-activity'

export function chartRouter() {
  return protectedRouter('/games/:gameId/charts', ({ route }) => {
    route(newPlayersRoute)
    route(statsActivityRoute)
  })
}
