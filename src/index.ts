import 'dotenv/config'
import Koa from 'koa'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import helmet from 'koa-helmet'
import configureProtectedRoutes from './config/protected-routes'
import configurePublicRoutes from './config/public-routes'
import configureAPIRoutes from './config/api-routes'
import corsMiddleware from './middlewares/cors-middleware'
import errorMiddleware from './middlewares/error-middleware'
import initProviders from './config/providers'
import createEmailQueue from './lib/queues/createEmailQueue'
import devDataMiddleware from './middlewares/dev-data-middleware'
import cleanupMiddleware from './middlewares/cleanup-middleware'
import requestContextMiddleware from './middlewares/request-context-middleware'
import { createServer } from 'http'
import configureSocketRoutes from './config/socket-routes'

const isTest = process.env.NODE_ENV === 'test'

export default async function init(): Promise<Koa> {
  const app = new Koa()

  await initProviders(app, isTest)

  if (!isTest) app.use(logger())
  app.use(errorMiddleware)
  app.use(bodyParser())
  app.use(helmet())
  app.use(corsMiddleware)
  app.use(requestContextMiddleware)
  app.use(devDataMiddleware)
  app.context.emailQueue = createEmailQueue()

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  app.use(cleanupMiddleware)

  const server = createServer(app.callback())
  configureSocketRoutes(server)

  if (!isTest) {
    server.listen(80, () => console.info('Listening on port 80'))
  }

  return app
}

if (!isTest) {
  init()
}
