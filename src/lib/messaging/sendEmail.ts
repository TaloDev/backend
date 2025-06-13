import nodemailer from 'nodemailer'
import { MailData } from '../../emails/mail'
import * as Sentry from '@sentry/node'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'

type MailDriver = 'relay' | 'log'

export default async function sendEmail(emailConfig: MailData): Promise<void> {
  const tracer = trace.getTracer('talo.email')
  await tracer.startActiveSpan('send_email', async (span) => {
    const templateData = (Object.entries(emailConfig.templateData).reduce((acc, [key, value]) => ({
      ...acc,
      [`email.template_data.${key}`]: value
    }), {}))

    setTraceAttributes({
      'email.recipient': emailConfig.to,
      'email.subject': emailConfig.subject,
      ...templateData
    })
    console.info('Sending mail')

    try {
      const driver = process.env.EMAIL_DRIVER as MailDriver | undefined
      if (!driver || driver === 'log') {
        sendLogEmail(emailConfig)
      } else if (driver === 'relay') {
        await sendRelayEmail(emailConfig)
      } else {
        throw new Error(`Unknown email driver: ${driver}. Supported drivers are 'relay' and 'log'.`)
      }

      span.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })

      Sentry.captureException(err, {
        extra: {
          to: emailConfig.to,
          subject: emailConfig.subject,
          attachments: emailConfig.attachments?.map((attachment) => attachment.filename)
        }
      })

      throw err
    } finally {
      span.end()
    }
  })
}

function sendLogEmail(emailConfig: MailData): void {
  const { html: _, ...rest } = emailConfig
  console.log('New mail:', JSON.stringify(rest, null, 2))
}

async function sendRelayEmail(emailConfig: MailData) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    throw new Error('Invalid mail configuration. One or more environment variables are missing: EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD.')
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    },
    logger: Boolean(process.env.EMAIL_DEBUG),
    debug: Boolean(process.env.EMAIL_DEBUG)
  })

  await transporter.verify()
  await transporter.sendMail({
    from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
    to: emailConfig.to,
    subject: emailConfig.subject,
    html: emailConfig.html,
    attachments: emailConfig.attachments?.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.type,
      disposition: att.disposition
    }))
  })
}
