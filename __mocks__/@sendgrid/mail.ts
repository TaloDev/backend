import SendGrid from '@sendgrid/mail'

export default {
  setApiKey: jest.fn(),
  send: jest.fn((data: SendGrid.MailDataRequired) => {
    if (data.subject.startsWith('fail')) {
      return Promise.reject({
        status: 403,
        response: {
          body: {
            errors: ['403 Forbidden']
          }
        }
      })
    }
  })
}
