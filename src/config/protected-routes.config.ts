import Koa from 'koa'
import { service } from 'koa-rest-services'
import APIKeysService from '../services/api-keys.service'
import EventsService from '../services/events.service'
import GamesService from '../services/games.service'
import PlayersService from '../services/players.service'

export default (app: Koa) => {
  app.use(service('apiKeys', new APIKeysService(), {
    basePath: '/api-keys'
  }))

  app.use(service('events', new EventsService(), {
    basePath: '/events'
  }))

  app.use(service('players', new PlayersService(), {
    basePath: '/players'
  }))

  app.use(service('games', new GamesService(), {
    basePath: '/games'
  }))
}
