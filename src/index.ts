import 'dotenv/config'
import Koa, { Context, Next } from 'koa'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import helmet from 'koa-helmet'
import { RequestContext } from '@mikro-orm/mysql'
import configureProtectedRoutes from './config/protected-routes.js'
import configurePublicRoutes from './config/public-routes.js'
import configureAPIRoutes from './config/api-routes.js'
import corsMiddleware from './middlewares/cors-middleware.js'
import errorMiddleware from './middlewares/error-middleware.js'
import initProviders from './config/providers.js'
import createEmailQueue from './lib/queues/createEmailQueue.js'
import devDataMiddleware from './middlewares/dev-data-middleware.js'
import cleanupMiddleware from './middlewares/cleanup-middleware.js'

const isTest = process.env.NODE_ENV === 'test'

export const init = async (): Promise<Koa> => {
  const app = new Koa()
  app.context.isTest = isTest

  await initProviders(app)

  if (!isTest) app.use(logger())
  app.use(errorMiddleware)
  app.use(bodyParser())
  app.use(helmet())
  app.use(corsMiddleware)
  app.use((ctx: Context, next: Next) => RequestContext.create(ctx.em, next))
  app.use(devDataMiddleware)
  app.context.emailQueue = createEmailQueue()

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  app.use(cleanupMiddleware)

  if (!isTest) app.listen(80, () => console.log('Listening on port 80'))
  return app
}

if (!isTest) init()

export default init
