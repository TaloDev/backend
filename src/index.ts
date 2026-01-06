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
import { setSocketInstance } from './socket/socketRegistry'
import httpTracingMiddleware from './middleware/http-tracing-middleware'
import { secondsToMilliseconds } from 'date-fns'
import compress from 'koa-compress'
import { EntityManager } from '@mikro-orm/mysql'

const isTest = process.env.NODE_ENV === 'test'

export default async function init(): Promise<Koa> {
  const app = new Koa()
  /* v8 ignore next */
  app.proxy = process.env.NO_PROXY !== '1'

  await initProviders(app, isTest)

  app.use(compress())
  if (!isTest) app.use(loggerMiddleware)
  app.use(errorMiddleware)
  app.use(bodyParser())
  if (!isTest) app.use(httpTracingMiddleware)
  app.use(helmetMiddleware)
  app.use(corsMiddleware)
  app.use(devDataMiddleware)
  app.use(requestContextMiddleware)

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  const server = createServer({
    connectionsCheckingInterval: secondsToMilliseconds(5),
    headersTimeout: secondsToMilliseconds(15),
    requestTimeout: secondsToMilliseconds(20),
    keepAliveTimeout: secondsToMilliseconds(60)
  }, app.callback())

  const socket = new Socket(server, (app.context.em as EntityManager).fork())
  app.context.wss = socket
  setSocketInstance(socket)

  if (!isTest) {
    server.listen(80, () => console.info('Listening on port 80'))
  }

  return app
}

if (!isTest) {
  init()
}
