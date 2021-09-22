import Koa from 'koa'
import { service } from 'koa-rest-services'
import DemoService from '../services/public/demo.service'
import UsersPublicService from '../services/public/users-public.service'

export default (app: Koa) => {
  app.use(service('/public/users', new UsersPublicService()))
  app.use(service('/public/demo', new DemoService()))
}
