import 'dotenv/config'
import './lib/tracing/sentry-instrument.js'
import './lib/tracing/enable-tracing.js'
import './lib/docs/docs-registry.js'
import { EntityManager } from '@mikro-orm/mysql'
import { secondsToMilliseconds } from 'date-fns'
import { createServer } from 'http'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import compress from 'koa-compress'
import helmet from 'koa-helmet'
import { configureAPIRoutes } from './config/api-routes.js'
import { configureProtectedRoutes } from './config/protected-routes.js'
import { initProviders } from './config/providers.js'
import { configurePublicRoutes } from './config/public-routes.js'
import { corsMiddleware } from './middleware/cors-middleware.js'
import { devDataMiddleware } from './middleware/dev-data-middleware.js'
import { errorMiddleware } from './middleware/error-middleware.js'
import { httpTracingMiddleware } from './middleware/http-tracing-middleware.js'
import { limiterMiddleware } from './middleware/limiter-middleware.js'
import { loggerMiddleware } from './middleware/logger-middleware.js'
import { requestContextMiddleware } from './middleware/request-context-middleware.js'
import { trailingSlashMiddleware } from './middleware/trailing-slash-middleware.js'
import Socket from './socket/index.js'
import { setSocketInstance } from './socket/socketRegistry.js'

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
  app.use(limiterMiddleware)

  configurePublicRoutes(app)
  configureProtectedRoutes(app)
  configureAPIRoutes(app)

  const server = createServer(
    {
      connectionsCheckingInterval: secondsToMilliseconds(5),
      headersTimeout: secondsToMilliseconds(10),
      requestTimeout: secondsToMilliseconds(20),
      keepAliveTimeout: secondsToMilliseconds(30),
    },
    app.callback(),
  )

  const socket = new Socket(server, (app.context.em as EntityManager).fork())
  app.context.wss = socket
  setSocketInstance(socket)

  if (!isTest) {
    server.listen(80, () => console.info('Listening on port 80'))
  }

  return app
}

if (!isTest) {
  void init()
}
