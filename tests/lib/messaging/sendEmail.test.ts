import ConfirmEmail from '../../../src/emails/confirm-email-mail'
import sendEmail from '../../../src/lib/messaging/sendEmail'
import UserFactory from '../../fixtures/UserFactory'

describe('Send email', () => {
  it('should gracefully handle errors', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')
    email.subject = 'fail'

    try {
      await sendEmail({
        ...email.getConfig(),
        attachments: [
          {
            content: 'file',
            filename: 'file.zip',
            type: 'application/zip',
            disposition: 'attachment',
            contentId: 'file.zip'
          }
        ]
      })
    } catch (err) {
      expect(err.status).toBe(403)
    }
  })

  it('should send valid templates', async () => {
    const user = await new UserFactory().one()
    const email = new ConfirmEmail(user, 'abc123')

    expect(async () => {
      await sendEmail(email.getConfig())
    }).not.toThrow()
  })
})
