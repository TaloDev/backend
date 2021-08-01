import sendEmail from "../../src/lib/messaging/sendEmail"

describe('Send email', () => {
  it('should gracefully handle errors', async () => {
    try {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'fail',
        templateId: 'confirm-email',
        templateData: {}
      })
    } catch (err) {
      expect(err.status).toBe(403)
    }
  })

  it('should gracefully handle non-sendgrid errors', async () => {
    try {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'fail',
        templateId: 'blah',
        templateData: {}
      })
    } catch (err) {
      expect(err.message).toContain('You passed undefined')
    }
  })

  it('should send valid templates', () => {
    expect(async () => {
      await sendEmail({
        to: 'bob@bob.com',
        subject: 'Your confirmation code',
        templateId: 'confirm-email',
        templateData: {}
      })
    }).not.toThrow()
  })
})
