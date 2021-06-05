import 'dotenv/config'
import Koa, { Context, Next } from 'koa'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import jwt from 'koa-jwt'
import helmet from 'koa-helmet'
import { MikroORM, RequestContext } from '@mikro-orm/core'
import configureProtectedRoutes from './config/protected-routes'
import configurePublicRoutes from './config/public-routes'
import configureAPIRoutes from './config/api-routes'
import corsMiddleware from './config/cors-middleware'
import errorMiddleware from './config/error-middleware'
import ormConfig from './config/mikro-orm.config'

const isTest = process.env.NODE_ENV === 'test'

export const init = async (): Promise<Koa> => {
  const app = new Koa()

  try {
    const orm = await MikroORM.init(ormConfig)
    app.context.em = orm.em
  } catch (err) {
    console.error(err)
    process.exit(1)
  }

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

  if (!isTest) {
    app.listen(process.env.SERVER_PORT, () => {
      console.log(`Listening on port ${process.env.SERVER_PORT}`)
    })
  }

  return app
}

if (!isTest) init()

export default init
