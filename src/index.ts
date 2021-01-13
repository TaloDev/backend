import 'dotenv/config'
import Koa, { Context } from 'koa'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import jwt from 'koa-jwt'
import helmet from 'koa-helmet'
import { EntityManager, MikroORM, RequestContext } from '@mikro-orm/core'
import configureProtectedRoutes from './config/protected-routes.config'
import configurePublicRoutes from './config/public-routes.config'
import configureAPIRoutes from './config/api-routes.config'

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
  app.use(helmet())
  app.use(jwt({ secret: process.env.JWT_SECRET }).unless({ path: [/^\/public/] }))
  app.use((ctx: Context, next) => RequestContext.createAsync(ctx.em, next))

  configureProtectedRoutes(app)
  configurePublicRoutes(app)
  configureAPIRoutes(app)

  app.listen(3000, async () => {
    console.log('Server listening...')
  })
}

init()
