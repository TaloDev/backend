import Koa from 'koa'
import { service } from 'koa-rest-services'
import EventsAPIService from '../services/api/events-api.service'
import GamesAPIService from '../services/api/games-api.service'
import PlayersAPIService, { playerAPIRoutes } from '../services/api/players-api.service'

export default (app: Koa) => {
  app.use(service('events-api', new EventsAPIService('events'), {
    basePath: '/api/events'
  }))

  app.use(service('players-api', new PlayersAPIService('players'), {
    basePath: '/api/players',
    routes: playerAPIRoutes
  }))

  app.use(service('games-api', new GamesAPIService('games'), {
    basePath: '/api/games'
  }))
}
