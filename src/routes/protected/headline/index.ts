import { protectedRouter } from '../../../lib/routing/router'
import { averageSessionDurationRoute } from './average-session-duration'
import { eventsRoute } from './events'
import { newPlayersRoute } from './new-players'
import { onlinePlayersRoute } from './online-players'
import { returningPlayersRoute } from './returning-players'
import { totalPlayersRoute } from './total-players'
import { totalSessionsRoute } from './total-sessions'
import { uniqueEventSubmittersRoute } from './unique-event-submitters'

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
