import Koa from 'koa'
import { service } from 'koa-rest-services'
import DemoService from '../services/public/demo.service'
import UsersPublicService, { usersPublicRoutes } from '../services/public/users-public.service'

export default (app: Koa) => {
  app.use(service('users-public', new UsersPublicService(), {
    basePath: '/public/users',
    routes: usersPublicRoutes
  }))

  app.use(service('demo', new DemoService(), {
    basePath: '/public/demo'
  }))
}
