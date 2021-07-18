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
})
