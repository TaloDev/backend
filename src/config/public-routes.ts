import Koa from 'koa'
import { service } from 'koa-clay'
import DemoService from '../services/public/demo.service'
import InvitePublicService from '../services/public/invite-public.service'
import UserPublicService from '../services/public/user-public.service'
import WebhookService from '../services/public/webhook.service'

export default (app: Koa) => {
  app.use(service('/public/webhooks', new WebhookService()))
  app.use(service('/public/invites', new InvitePublicService()))
  app.use(service('/public/users', new UserPublicService()))
  app.use(service('/public/demo', new DemoService()))
}
