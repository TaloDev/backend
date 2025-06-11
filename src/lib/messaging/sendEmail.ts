import nodemailer from 'nodemailer'
import { MailData } from '../../emails/mail'
import * as Sentry from '@sentry/node'

type MailDriver = 'relay' | 'log'

export type EmailConfigMetadata = {
  [key: string]: string | number
}

export type EmailConfig = {
  mail: MailData
  metadata?: EmailConfigMetadata
}

export default async function sendEmail(emailConfig: MailData): Promise<void> {
  try {
    const driver = process.env.EMAIL_DRIVER as MailDriver | undefined
    if (!driver || driver === 'log') {
      sendLogEmail(emailConfig)
    } else if (driver === 'relay') {
      await sendRelayEmail(emailConfig)
    } else {
      throw new Error(`Unknown email driver: ${driver}. Supported drivers are 'relay' and 'log'.`)
    }
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        to: emailConfig.to,
        subject: emailConfig.subject,
        attachments: emailConfig.attachments?.map((attachment) => attachment.filename)
      }
    })

    throw err
  }
}

function sendLogEmail(emailConfig: MailData): void {
  const { html, ...rest } = emailConfig
  console.log('New mail:', JSON.stringify(rest, null, 2))
  console.log(html)
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
