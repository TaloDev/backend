import 'dotenv/config'
import Koa, { Context, Next } from 'koa'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import jwt from 'koa-jwt'
import helmet from 'koa-helmet'
import { RequestContext } from '@mikro-orm/core'
import configureProtectedRoutes from './config/protected-routes'
import configurePublicRoutes from './config/public-routes'
import configureAPIRoutes from './config/api-routes'
import corsMiddleware from './config/cors-middleware'
import errorMiddleware from './config/error-middleware'
import initProviders from './config/providers'
import createEmailQueue from './lib/queues/createEmailQueue'

const isTest = process.env.NODE_ENV === 'test'

export const init = async (): Promise<Koa> => {
  const app = new Koa()

  await initProviders(app)

  if (!isTest) app.use(logger())
  app.use(errorMiddleware)
  app.use(bodyParser())
  app.use(helmet())

  app.use(corsMiddleware)
  app.use(jwt({ secret: process.env.JWT_SECRET }).unless({ path: [/^\/public/] }))

  app.use((ctx: Context, next: Next) => RequestContext.createAsync(ctx.em, next))

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  app.context.emailQueue = createEmailQueue()

  if (!isTest) app.listen(80, () => console.log('Listening on port 80'))

  return app
}

if (!isTest) init()

export default init
