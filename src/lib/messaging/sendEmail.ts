import SendGrid, { MailDataRequired } from '@sendgrid/mail'
import * as Sentry from '@sentry/node'

export interface EmailConfig {
  mail: MailDataRequired
}

export default async (emailConfig: MailDataRequired): Promise<void> => {
  try {
    await SendGrid.send(emailConfig)
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        errors: err.response.body?.errors ?? err.message,
        to: emailConfig.to,
        subject: emailConfig.subject,
        attachments: emailConfig.attachments.map((attachment) => attachment.filename)
      }
    })

    throw err
  }
}
