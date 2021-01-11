import 'dotenv/config'
import Koa from 'koa'
import { service } from 'koa-rest-services'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import jwt from 'koa-jwt'
import { EntityManager, MikroORM, RequestContext } from '@mikro-orm/core'
import EventsAPIService from './services/api/events-api.service'
import PlayersAPIService, { playerAPIRoutes } from './services/api/players-api.service'
import GamesAPIService from './services/api/games-api.service'
import APIKeysService from './services/api-keys.service'
import EventsService from './services/events.service'
import UsersPublicService, { usersPublicRoutes } from './services/public/users-public.service'
import PlayersService from './services/players.service'
import GamesService from './services/games.service'

const initRoutes = (app: Koa) => {
  app.use(service('users-public', new UsersPublicService(), {
    basePath: '/public/users',
    routes: usersPublicRoutes
  }))

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

const initAPIRoutes = (app: Koa) => {
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

const init = async () => {
  let em: EntityManager
  try {
    console.log('Starting DB...')
    const orm = await MikroORM.init()
    em = orm.em
    console.log('DB ready')
  } catch (err) {
    console.error(err)
    console.log('DB failed to start')
    process.exit(1)
  }

  const app = new Koa()
  app.context.em = em
  app.use(logger())
  app.use(bodyParser())
  app.use((ctx, next) => RequestContext.createAsync(ctx.em, next))
  app.use(jwt({ secret: process.env.JWT_SECRET }).unless({ path: [/^\/public/] }))

  initRoutes(app)
  initAPIRoutes(app)

  app.listen(3000, async () => {
    console.log('Server listening...')
  })
}

init()
