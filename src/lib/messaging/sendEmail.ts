import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'
import * as Handlebars from 'handlebars'
import emails from '../../emails'

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
    const template = Handlebars.compile(emails[emailConfig.templateId])

    await SendGrid.send({
      to: emailConfig.to,
      from: emailConfig.from || process.env.FROM_EMAIL,
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
