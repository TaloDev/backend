import { protectedRouter } from '../../../lib/routing/router'
import { newPlayersRoute } from './new-players'
import { returningPlayersRoute } from './returning-players'
import { eventsRoute } from './events'
import { uniqueEventSubmittersRoute } from './unique-event-submitters'
import { totalPlayersRoute } from './total-players'
import { onlinePlayersRoute } from './online-players'
import { totalSessionsRoute } from './total-sessions'
import { averageSessionDurationRoute } from './average-session-duration'

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
