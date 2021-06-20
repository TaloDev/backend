import sendEmail from "../../src/lib/messaging/sendEmail"

describe('Send email', () => {
  it('should gracefully handle errors', async () => {
    try {
      await sendEmail('bob@bob.com', 'fail-123', { errors: ['403 Forbidden'] })
    } catch (err) {
      expect(err.message).toBe('Failed to send email with templateId fail-123')
    }
  })
})
