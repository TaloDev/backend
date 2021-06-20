import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'

interface TemplateData {
  [key: string]: any
}

export default async (to: string, templateId: string, dynamicTemplateData?: TemplateData): Promise<void> => {
  try {
    await SendGrid.send({
      to,
      from: 'hello@trytalo.com',
      templateId,
      dynamicTemplateData
    })
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        errors: err.response.body.errors,
        to,
        templateId
      }
    })
  }
}
