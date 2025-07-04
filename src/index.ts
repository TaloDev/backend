import 'dotenv/config'
import './lib/tracing/sentry-instrument'
import './lib/tracing/enable-tracing'
import Koa from 'koa'
import loggerMiddleware from './middleware/logger-middleware'
import bodyParser from 'koa-bodyparser'
import configureProtectedRoutes from './config/protected-routes'
import configurePublicRoutes from './config/public-routes'
import configureAPIRoutes from './config/api-routes'
import corsMiddleware from './middleware/cors-middleware'
import errorMiddleware from './middleware/error-middleware'
import initProviders from './config/providers'
import devDataMiddleware from './middleware/dev-data-middleware'
import requestContextMiddleware from './middleware/request-context-middleware'
import helmetMiddleware from './middleware/helmet-middleware'
import { createServer } from 'http'
import Socket from './socket'

const isTest = process.env.NODE_ENV === 'test'

export default async function init(): Promise<Koa> {
  const app = new Koa()

  await initProviders(app, isTest)

  if (!isTest) app.use(loggerMiddleware)
  app.use(errorMiddleware)
  app.use(bodyParser())
  app.use(helmetMiddleware)
  app.use(corsMiddleware)
  app.use(devDataMiddleware)
  app.use(requestContextMiddleware)

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  const server = createServer(app.callback())
  app.context.wss = new Socket(server, app.context.em)
  if (!isTest) {
    server.listen(80, () => console.info('Listening on port 80'))
  }

  return app
}

if (!isTest) {
  init()
}
