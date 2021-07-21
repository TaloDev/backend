import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'
import { promises as fs } from 'fs'
import path from 'path'
import * as Handlebars from 'handlebars'

interface TemplateData {
  [key: string]: any
}

export interface EmailConfig {
  to: string
  from?: string
  subject: string
  templateId: string
  templateData: TemplateData
}

export default async (emailConfig: EmailConfig): Promise<void> => {
  try {
    const html = await fs.readFile(path.resolve(__dirname + `../../../emails/${emailConfig.templateId}.html`), 'utf8')
    const template = Handlebars.compile(html)

    await SendGrid.send({
      to: emailConfig.to,
      from: emailConfig.from || 'hello@trytalo.com',
      subject: emailConfig.subject,
      html: template(emailConfig.templateData)
    })
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        errors: err.response?.body.errors ?? err.message,
        to: emailConfig.to,
        templateId: emailConfig.templateId
      }
    })

    throw err
  }
}
