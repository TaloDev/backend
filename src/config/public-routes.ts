import Koa from 'koa'
import { service } from 'koa-clay'
import DemoService from '../services/public/demo.service'
import UserPublicService from '../services/public/users-public.service'

export default (app: Koa) => {
  app.use(service('/public/users', new UserPublicService()))
  app.use(service('/public/demo', new DemoService()))
}
