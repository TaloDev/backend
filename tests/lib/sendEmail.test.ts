import confirmEmail from "../../src/emails/confirm-email"
import sendEmail from "../../src/lib/messaging/sendEmail"

describe('Send email', () => {
  it('should gracefully handle errors', async () => {
    try {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'fail',
        template: confirmEmail,
        templateData: {}
      })
    } catch (err) {
      expect(err.status).toBe(403)
    }
  })

  it('should gracefully handle handlebars errors', async () => {
    try {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'fail',
        template: null,
        templateData: {}
      })
    } catch (err) {
      expect(err.message).toBe('You must pass a string or Handlebars AST to Handlebars.compile. You passed null')
    }
  })

  it('should send valid templates', () => {
    expect(async () => {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'Your confirmation code',
        template: confirmEmail,
        templateData: {}
      })
    }).not.toThrow()
  })
})
