import 'dotenv/config'
import './lib/tracing/sentry-instrument'
import './lib/tracing/enable-tracing'
import './lib/docs/docs-registry'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { loggerMiddleware } from './middleware/logger-middleware'
import { configureProtectedRoutes } from './config/protected-routes'
import { configureAPIRoutes } from './config/api-routes'
import { configurePublicRoutes } from './config/public-routes'
import { corsMiddleware } from './middleware/cors-middleware'
import { errorMiddleware } from './middleware/error-middleware'
import { initProviders } from './config/providers'
import { devDataMiddleware } from './middleware/dev-data-middleware'
import { requestContextMiddleware } from './middleware/request-context-middleware'
import { httpTracingMiddleware } from './middleware/http-tracing-middleware'
import helmet from 'koa-helmet'
import compress from 'koa-compress'
import { createServer } from 'http'
import Socket from './socket'
import { setSocketInstance } from './socket/socketRegistry'
import { secondsToMilliseconds } from 'date-fns'
import { EntityManager } from '@mikro-orm/mysql'
import { trailingSlashMiddleware } from './middleware/trailing-slash-middleware'

const isTest = process.env.NODE_ENV === 'test'

export default async function init() {
  const app = new Koa()
  app.proxy = process.env.NO_PROXY !== '1'

  await initProviders(app, isTest)

  app.use(compress())
  app.use(trailingSlashMiddleware)
  if (!isTest) app.use(loggerMiddleware)
  app.use(errorMiddleware)
  app.use(bodyParser())
  if (!isTest) app.use(httpTracingMiddleware)
  app.use(helmet())
  app.use(corsMiddleware)
  app.use(devDataMiddleware)
  app.use(requestContextMiddleware)

  configurePublicRoutes(app)
  configureProtectedRoutes(app)
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
