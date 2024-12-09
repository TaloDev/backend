import Koa from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import DemoService from '../services/public/demo.service'
import DocumentationService from '../services/public/documentation.service'
import InvitePublicService from '../services/public/invite-public.service'
import UserPublicService from '../services/public/user-public.service'
import WebhookService from '../services/public/webhook.service'

export default function configurePublicRoutes(app: Koa) {
  const serviceOpts: ServiceOpts = {
    docs: {
      hidden: true
    }
  }

  app.use(service('/public/docs', new DocumentationService(), serviceOpts))
  app.use(service('/public/webhooks', new WebhookService(), serviceOpts))
  app.use(service('/public/invites', new InvitePublicService(), serviceOpts))
  app.use(service('/public/users', new UserPublicService(), serviceOpts))
  app.use(service('/public/demo', new DemoService(), serviceOpts))
}
