import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'
import * as Handlebars from 'handlebars'

interface TemplateData {
  [key: string]: any
}

interface AttachmentData {
  content: string;
  filename: string;
  type?: string;
  disposition?: string;
  content_id?: string;
}

export interface EmailConfig {
  to: string
  from?: string
  subject: string
  template: string
  templateData?: TemplateData,
  attachments?: AttachmentData[]
}

export default async (emailConfig: EmailConfig): Promise<void> => {
  try {
    const template = Handlebars.compile(emailConfig.template)

    await SendGrid.send({
      to: emailConfig.to,
      from: emailConfig.from || process.env.FROM_EMAIL,
      subject: emailConfig.subject,
      html: template(emailConfig.templateData),
      attachments: emailConfig.attachments || []
    })
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        errors: err.response?.body.errors ?? err.message,
        to: emailConfig.to,
        subject: emailConfig.subject,
        attachments: emailConfig.attachments?.map((attachment) => attachment.filename)
      }
    })

    throw err
  }
}
