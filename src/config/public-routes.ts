import Koa from 'koa'
import { service } from 'koa-rest-services'
import DemoService from '../services/public/demo.service'
import UsersPublicService from '../services/public/users-public.service'

export default (app: Koa) => {
  app.use(service('users-public', new UsersPublicService(), {
    prefix: '/public/users'
  }))

  app.use(service('demo', new DemoService(), {
    prefix: '/public/demo'
  }))
}
