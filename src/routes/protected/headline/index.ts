import { protectedRouter } from '../../../lib/routing/router.js'
import { averageSessionDurationRoute } from './average-session-duration.js'
import { eventsRoute } from './events.js'
import { newPlayersRoute } from './new-players.js'
import { onlinePlayersRoute } from './online-players.js'
import { returningPlayersRoute } from './returning-players.js'
import { totalPlayersRoute } from './total-players.js'
import { totalSessionsRoute } from './total-sessions.js'
import { uniqueEventSubmittersRoute } from './unique-event-submitters.js'

export function headlineRouter() {
  return protectedRouter('/games/:gameId/headlines', ({ route }) => {
    route(newPlayersRoute)
    route(returningPlayersRoute)
    route(eventsRoute)
    route(uniqueEventSubmittersRoute)
    route(totalPlayersRoute)
    route(onlinePlayersRoute)
    route(totalSessionsRoute)
    route(averageSessionDurationRoute)
  })
}
