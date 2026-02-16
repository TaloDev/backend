import { protectedRouter } from '../../../lib/routing/router'
import { newPlayersRoute } from './new-players'

export function chartRouter() {
  return protectedRouter('/games/:gameId/charts', ({ route }) => {
    route(newPlayersRoute)
  })
}
