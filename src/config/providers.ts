import Koa from 'koa'
import SendGrid from '@sendgrid/mail'

const initProviders = (app: Koa) => {
  SendGrid.setApiKey(process.env.SENDGRID_KEY)
}

export default initProviders
