import Koa from 'koa'
import { service } from 'koa-rest-services'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import { EntityManager, MikroORM, RequestContext } from '@mikro-orm/core'
import 'dotenv/config'
import EventsService from './services/events-service'
import PlayersService, { routes as playersRoutes } from './services/players-service'
import GamesService from './services/games-service'
import APIKeysService from './services/api-keys-service'

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

  app.use(service('events', new EventsService(), {
    basePath: '/events'
  }))

  app.use(service('players', new PlayersService(), {
    basePath: '/players',
    routes: playersRoutes
  }))

  app.use(service('games', new GamesService(), {
    basePath: '/games'
  }))

  app.use(service('apiKeys', new APIKeysService(), {
    basePath: '/api-keys'
  }))

  app.listen(3000, async () => {
    console.log('Server listening...')
  })
}

init()
