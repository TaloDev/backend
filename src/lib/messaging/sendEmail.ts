import nodemailer from 'nodemailer'
import { MailData } from '../../emails/mail'
import { captureException } from '@sentry/node'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import fs from 'fs/promises'
import path from 'path'

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
        await sendLogEmail(emailConfig)
      } else if (driver === 'relay') {
        await sendRelayEmail(emailConfig)
      } else {
        throw new Error(`Unknown email driver: ${driver}. Supported drivers are 'relay' and 'log'.`)
      }

      span.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })

      captureException(err, {
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

function sanitisePathPart(part: Date | string): string {
  if (part instanceof Date) {
    return part.toISOString().replace(/[:.\-TZ]/g, '')
  }

  return part.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase()
}

async function sendLogEmail(emailConfig: MailData): Promise<void> {
  const {
    html,
    attachments,
    ...rest
  } = emailConfig

  console.log('New mail:', JSON.stringify(rest, null, 2))

  const baseDir = path.join(process.cwd(), 'storage', 'mail')
  const safeTo = sanitisePathPart(emailConfig.to)
  const safeSubject = sanitisePathPart(emailConfig.subject)
  const timestamp = sanitisePathPart(new Date())

  // save files to storage/mail/{safeEmail}/{safeSubject}/{timestamp}
  const fullDir = path.join(baseDir, safeTo, safeSubject, timestamp)

  try {
    await fs.mkdir(fullDir, { recursive: true })

    const htmlPath = path.join(fullDir, 'mail.html')
    await fs.writeFile(htmlPath, html, 'utf-8')

    await Promise.all((attachments ?? []).map(async (attachment) => {
      const contentBuffer = Buffer.from(attachment.content, 'base64')
      const safeFilename = path.basename(attachment.filename)
      const filePath = path.join(fullDir, safeFilename)
      await fs.writeFile(filePath, contentBuffer)
    }))
    console.log(`Saved mail files to ${fullDir}`)
  } catch (error) {
    console.error('Could not write mail file to disk:', error)
  }
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
