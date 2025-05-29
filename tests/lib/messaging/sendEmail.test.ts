import ConfirmEmail from '../../../src/emails/confirm-email-mail'
import sendEmail from '../../../src/lib/messaging/sendEmail'
import UserFactory from '../../fixtures/UserFactory'
import nodemailer, { Transporter } from 'nodemailer'

describe('Send email', () => {
  const originalDriver = process.env.EMAIL_DRIVER

  const mockTransport = {
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn().mockResolvedValue(true)
  }

  beforeEach(() => {
    process.env.EMAIL_DRIVER = 'relay'
    process.env.EMAIL_HOST = 'smtp.example.com'
    process.env.EMAIL_PORT = '587'
    process.env.EMAIL_USERNAME = 'user@example.com'
    process.env.EMAIL_PASSWORD = 'password'

    vi.spyOn(nodemailer, 'createTransport').mockReturnValue(
      mockTransport as unknown as Transporter
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockTransport.verify.mockClear()
    mockTransport.sendMail.mockClear()
    process.env.EMAIL_DRIVER = originalDriver
  })

  it('should handle SMTP connection errors', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    mockTransport.verify.mockRejectedValueOnce(new Error('SMTP Connection failed'))

    await expect(sendEmail(email.getConfig())).rejects.toThrow('SMTP Connection failed')
  })

  it('should handle email sending errors', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    mockTransport.sendMail.mockRejectedValueOnce(new Error('Failed to send email'))

    await expect(sendEmail(email.getConfig())).rejects.toThrow('Failed to send email')
  })

  it('should send valid templates', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    await expect(sendEmail(email.getConfig())).resolves.not.toThrow()
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
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
  })

  it('should properly configure email attachments', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    const emailConfig = {
      ...email.getConfig(),
      attachments: [
        {
          content: 'file',
          filename: 'file.zip',
          type: 'application/zip',
          disposition: 'attachment',
          content_id: 'file.zip'
        }
      ]
    }

    await sendEmail(emailConfig)

    expect(mockTransport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [{
        content: 'file',
        filename: 'file.zip',
        contentType: 'application/zip',
        disposition: 'attachment',
        cid: 'file.zip'
      }]
    }))
  })

  it('should throw an error if part of the email configuration is missing', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    const originalHost = process.env.EMAIL_HOST
    delete process.env.EMAIL_HOST

    await expect(sendEmail(email.getConfig())).rejects.toThrow(
      'Invalid mail configuration. One or more environment variables are missing: EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD.'
    )

    process.env.EMAIL_HOST = originalHost
  })

  it('should use the relay driver when EMAIL_DRIVER is relay', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    process.env.EMAIL_DRIVER = 'relay'
    const consoleSpy = vi.spyOn(console, 'log')

    await sendEmail(email.getConfig())

    expect(mockTransport.sendMail).toHaveBeenCalled()
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should use the log driver when EMAIL_DRIVER is log', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    process.env.EMAIL_DRIVER = 'log'
    const consoleSpy = vi.spyOn(console, 'log')

    await sendEmail(email.getConfig())

    expect(mockTransport.sendMail).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledTimes(2) // once for metadata, once for HTML
    expect(consoleSpy).toHaveBeenCalledWith('New mail:', expect.any(String))

    consoleSpy.mockRestore()
  })

  it('should use the log driver when EMAIL_DRIVER is undefined', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    delete process.env.EMAIL_DRIVER
    const consoleSpy = vi.spyOn(console, 'log')

    await sendEmail(email.getConfig())

    expect(mockTransport.sendMail).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledTimes(2) // once for metadata, once for HTML
    expect(consoleSpy).toHaveBeenCalledWith('New mail:', expect.any(String))

    consoleSpy.mockRestore()
  })

  it('should throw an error if email driver is unknown', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    process.env.EMAIL_DRIVER = 'unknown'

    await expect(sendEmail(email.getConfig())).rejects.toThrow(
      'Unknown email driver: unknown. Supported drivers are \'relay\' and \'log\'.'
    )
  })

  it('should throw an error if email configuration is missing', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    const originalHost = process.env.EMAIL_HOST
    delete process.env.EMAIL_HOST

    await expect(sendEmail(email.getConfig())).rejects.toThrow(
      'Invalid mail configuration. One or more environment variables are missing: EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD.'
    )

    process.env.EMAIL_HOST = originalHost
  })
})
