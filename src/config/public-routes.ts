import Koa from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import DocumentationService from '../services/public/documentation.service'
import InvitePublicService from '../services/public/invite-public.service'
import WebhookService from '../services/public/webhook.service'
import { healthCheckRouter } from '../routes/public/health-check'
import { userPublicRouter } from '../routes/public/user-public'
import { demoRouter } from '../routes/public/demo'

export default function configurePublicRoutes(app: Koa) {
  const serviceOpts: ServiceOpts = {
    docs: {
      hidden: true
    }
  }

  app.use(service('/public/docs', new DocumentationService(), serviceOpts))
  app.use(service('/public/webhooks', new WebhookService(), serviceOpts))
  app.use(service('/public/invites', new InvitePublicService(), serviceOpts))

  // new router-based routes
  app.use(healthCheckRouter().routes())
  app.use(userPublicRouter().routes())
  app.use(demoRouter().routes())
}
